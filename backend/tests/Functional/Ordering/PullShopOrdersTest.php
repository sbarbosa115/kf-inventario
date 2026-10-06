<?php

namespace App\Tests\Functional\Ordering;

use App\Ordering\Application\Command\PulledShopOrders;
use App\Ordering\Application\Command\PullShopOrders;
use App\Ordering\Application\Port\RemoteNote;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderCommentMeta;
use App\Ordering\Domain\Model\ShopDelivery;
use App\Ordering\Domain\Model\ShopOrderLink;
use App\Shared\Application\Command\CommandBus;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/**
 * The catch-up pull of one connection (docs/pdr/prd-shops-settings.md, Decisions 11): the shop's orders modified
 * since the connection's cursor (none yet: the gateway's 30-day window), the new `processing` ones placed as the
 * webhook places them, the linked ones' customer notes imported once and their shop status recorded. The cursor
 * moves to the newest modification seen, and only when the shop could be read.
 */
final class PullShopOrdersTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OrderingFixtures;
    use ShopConnections;
    use SignsIn;

    private const SHOP = 'https://kfvintage.example.com';

    protected function setUp(): void
    {
        parent::setUp();
        FakeShopGateway::reset();
        self::mockTime('2026-10-06 10:00:00');
    }

    public function testOnlyTheNewProcessingOrdersArePlacedInTheConnectionsWarehouseAndLinked(): void
    {
        $id = $this->aShop();
        FakeShopGateway::shop(self::SHOP, 'ck_live_key', 'cs_live_secret', [
            self::modified(self::shopOrder(5501), '2026-10-05T12:00:00'),
            self::modified(self::shopOrder(5502), '2026-10-05T13:00:00'),
            self::modified(['status' => 'pending'] + self::shopOrder(5503), '2026-10-05T14:00:00'),
        ]);

        $pulled = $this->pull($id);

        self::assertNull($pulled->error);
        self::assertSame([2, 0], [$pulled->imported, $pulled->skipped], 'A pending order is not placed: only processing ones are, as before.');
        $this->em()->clear();
        $order = $this->em()->getRepository(Order::class)->findOneBy(['code' => '5501']);
        self::assertNotNull($order);
        self::assertSame('Usa', $order->getWarehouse()?->getName(), 'The connection\'s warehouse.');
        $link = $this->em()->getRepository(ShopOrderLink::class)->findOneBy(['order' => $order]);
        self::assertSame([$id, '5501'], [$link?->connection()->id(), $link?->remoteOrderId()], 'A pulled order names its shop, as a webhook one does.');
        self::assertNull($this->em()->getRepository(Order::class)->findOneBy(['code' => '5503']));
        self::assertSame(['status' => 'any', 'shop' => self::SHOP], ['status' => FakeShopGateway::reads()[0]['status'], 'shop' => FakeShopGateway::reads()[0]['shop']], 'One read: every status, for the linked orders\' notes and status too.');
    }

    public function testOrdersTheAppAlreadyHoldsAreSkippedSoPullingTwiceChangesNothing(): void
    {
        $id = $this->aShop();
        FakeShopGateway::shop(self::SHOP, 'ck_live_key', 'cs_live_secret', [self::modified(self::shopOrder(5501), '2026-10-05T12:00:00')]);
        $this->pull($id);
        $this->connectionWithCursor($id, null);

        $again = $this->pull($id);

        self::assertSame([0, 1], [$again->imported, $again->skipped], 'Already linked: a duplicate, nothing stored.');
        $this->em()->clear();
        self::assertSame(1, $this->em()->getRepository(Order::class)->count(['code' => '5501']));
        self::assertSame([], $this->deliveries(), 'A duplicate is not a failed delivery.');
    }

    public function testWithoutACursorTheGatewayIsAskedForItsDefaultWindowAndTheCursorMovesToTheNewestModification(): void
    {
        $id = $this->aShop();
        FakeShopGateway::shop(self::SHOP, 'ck_live_key', 'cs_live_secret', [
            self::modified(self::shopOrder(5502), '2026-10-05T13:30:00'),
            self::modified(self::shopOrder(5501), '2026-10-05T12:00:00'),
        ]);

        $this->pull($id);

        self::assertNull(FakeShopGateway::reads()[0]['since'], 'No cursor yet: the gateway reads its 30-day window (RestShopGateway::DAYS).');
        $connection = $this->connection($id);
        self::assertSame('2026-10-05T13:30:00+00:00', $connection->pullCursor()?->setTimezone(new \DateTimeZone('UTC'))->format(\DATE_ATOM), 'The newest date_modified_gmt seen.');
        self::assertSame('America/Bogota', $connection->pullCursor()->getTimezone()->getName(), 'Stored in Bogota time, as every date.');
        self::assertEquals(new \DateTimeImmutable('2026-10-06 10:00:00'), $connection->lastPullOkAt());
        self::assertEquals(new \DateTimeImmutable('2026-10-06 10:00:00'), $connection->lastPullAt());
    }

    public function testWithACursorOnlyWhatWasModifiedSinceIsAskedFor(): void
    {
        $id = $this->aShop();
        FakeShopGateway::shop(self::SHOP, 'ck_live_key', 'cs_live_secret', [self::modified(self::shopOrder(5501), '2026-10-05T12:00:00')]);
        $this->pull($id);
        FakeShopGateway::shop(self::SHOP, 'ck_live_key', 'cs_live_secret', [
            self::modified(self::shopOrder(5501), '2026-10-05T12:00:00'),
            self::modified(self::shopOrder(5502), '2026-10-06T09:00:00'),
        ]);

        $second = $this->pull($id);

        self::assertEquals(new \DateTimeImmutable('2026-10-05T12:00:00+00:00'), FakeShopGateway::reads()[1]['since'], 'The cursor of the first pull.');
        self::assertSame([1, 0], [$second->imported, $second->skipped], 'Only 5502 changed since: 5501 is not even read again.');
    }

    public function testTheCursorStaysWhenTheShopCannotBeReadAndTheFailureIsInTheHealth(): void
    {
        $id = $this->aShop();
        FakeShopGateway::shop(self::SHOP, 'ck_live_key', 'cs_live_secret', [self::modified(self::shopOrder(5501), '2026-10-05T12:00:00')]);
        $this->pull($id);
        self::mockTime('2026-10-06 10:20:00');
        FakeShopGateway::failing(self::SHOP, 'Connection timed out');

        $failed = $this->pull($id);

        self::assertSame('Connection timed out', $failed->error);
        $connection = $this->connection($id);
        self::assertEquals(new \DateTimeImmutable('2026-10-05T12:00:00+00:00'), $connection->pullCursor(), 'Only a successful pull moves the cursor: nothing is lost.');
        self::assertEquals(new \DateTimeImmutable('2026-10-06 10:20:00'), $connection->lastPullAt(), 'The attempt counts for --if-due.');
        self::assertEquals(new \DateTimeImmutable('2026-10-06 10:00:00'), $connection->lastPullOkAt());
        self::assertSame(['pull_failed', 'Connection timed out'], [$connection->lastFailureCode(), $connection->lastFailure()]);
        self::assertTrue($connection->isFailing(), 'The Orders warning shows it.');
    }

    public function testAnOrderThatCannotBePlacedWaitsInTheInboxAndThePullStillSucceeds(): void
    {
        $id = $this->aShop();
        FakeShopGateway::shop(self::SHOP, 'ck_live_key', 'cs_live_secret', [
            self::modified(self::shopOrder(5501, [['KF-99', 1]]), '2026-10-05T12:00:00'),
            self::modified(self::shopOrder(5502), '2026-10-05T13:00:00'),
        ]);

        $pulled = $this->pull($id);

        self::assertSame([1, 1], [$pulled->imported, $pulled->skipped]);
        $deliveries = $this->deliveries();
        self::assertCount(1, $deliveries);
        self::assertSame([ShopDelivery::KIND_PULL, '5501', ShopDelivery::REASON_UNKNOWN_PRODUCT], [$deliveries[0]->kind(), $deliveries[0]->remoteOrderId(), $deliveries[0]->reasonCode()]);
        self::assertNotNull($this->connection($id)->pullCursor(), 'The shop was read: an order kept in the inbox is retried from there.');
    }

    public function testCustomerNotesOfLinkedOrdersBecomeShopCommentsOnceAndTheirShopStatusIsRecorded(): void
    {
        $id = $this->aShop();
        FakeShopGateway::shop(self::SHOP, 'ck_live_key', 'cs_live_secret', [self::modified(self::shopOrder(5501), '2026-10-05T12:00:00')]);
        $this->pull($id);
        FakeShopGateway::shop(self::SHOP, 'ck_live_key', 'cs_live_secret', [self::modified(['status' => 'on-hold'] + self::shopOrder(5501), '2026-10-06T09:00:00')]);
        FakeShopGateway::notes(self::SHOP, '5501', [
            new RemoteNote('71', 'Please ship before Friday', true, new \DateTimeImmutable('2026-10-06T08:30:00+00:00')),
            new RemoteNote('72', 'Payment captured', false, new \DateTimeImmutable('2026-10-06T08:31:00+00:00')),
        ]);

        $this->pull($id);
        $this->connectionWithCursor($id, null);
        $this->pull($id);

        $this->em()->clear();
        $order = $this->em()->getRepository(Order::class)->findOneBy(['code' => '5501']);
        $comments = $this->em()->getRepository(Comment::class)->findBy(['order' => $order]);
        self::assertSame(['Please ship before Friday'], array_map(static fn (Comment $c) => $c->getContent(), $comments), 'Customer notes only (Open questions, answer 2), once however often it is pulled.');
        self::assertNull($comments[0]->getUser());
        self::assertSame('2026-10-06 03:30', $comments[0]->getCreatedAt()?->format('Y-m-d H:i'), 'The note\'s own date, in Bogota time.');
        $meta = $this->em()->find(OrderCommentMeta::class, $comments[0]->getId());
        self::assertSame([OrderCommentMeta::ORIGIN_SHOP, $id, '71'], [$meta?->origin(), $meta?->connection()?->id(), $meta?->remoteNoteId()]);
        $link = $this->em()->getRepository(ShopOrderLink::class)->findOneBy(['order' => $order]);
        self::assertSame('on-hold', $link?->remoteStatus(), 'The shop\'s status as last seen.');
        self::assertSame(1, $this->em()->getRepository(Order::class)->count(['code' => '5501']), 'A linked order in another status is never placed again.');
    }

    public function testAnInactiveConnectionIsNotRead(): void
    {
        $id = $this->aShop(['active' => false]);
        FakeShopGateway::shop(self::SHOP, 'ck_live_key', 'cs_live_secret', [self::modified(self::shopOrder(5501), '2026-10-05T12:00:00')]);

        $pulled = $this->pull($id);

        self::assertSame([0, 0], [$pulled->imported, $pulled->skipped]);
        self::assertSame([], FakeShopGateway::reads());
    }

    /**
     * @param array<string, mixed> $overrides
     */
    private function aShop(array $overrides = []): int
    {
        $warehouse = $this->aWarehouse('Usa');
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);

        return (int) $this->aConnection($warehouse, $overrides + ['email_printer' => false])['id'];
    }

    private function pull(int $connectionId): PulledShopOrders
    {
        $pulled = static::getContainer()->get(CommandBus::class)->dispatch(new PullShopOrders($connectionId));
        self::assertInstanceOf(PulledShopOrders::class, $pulled);

        return $pulled;
    }

    /** Puts the connection's cursor back (or away), as if the shop's orders had all changed again. */
    private function connectionWithCursor(int $id, ?string $cursor): void
    {
        $this->em()->getConnection()->executeStatement('UPDATE shop_connection SET pull_cursor = ? WHERE id = ?', [$cursor, $id]);
        $this->em()->clear();
    }

    /**
     * @param array<string, mixed> $order
     *
     * @return array<string, mixed>
     */
    private static function modified(array $order, string $gmt): array
    {
        return ['date_modified_gmt' => $gmt] + $order;
    }
}
