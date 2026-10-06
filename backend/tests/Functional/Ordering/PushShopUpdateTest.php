<?php

namespace App\Tests\Functional\Ordering;

use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Application\Command\PushShopUpdate;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\ShopCapability;
use App\Ordering\Domain\Model\ShopOrderLink;
use App\Ordering\Domain\Model\ShopOutbox;
use App\Shared\Application\Command\CommandBus;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/**
 * The write-back (docs/pdr/prd-shops-settings.md, Decisions 10): a status change of an order that came from a
 * connection writes an outbox row and queues it on `shops` (sync:// in tests: pushed at once). Processed →
 * `processing`, Sent and Delivered → `completed`, every other status nothing; the same shop status is not pushed twice.
 * A push that fails is tried again 1 and 5 minutes later; the third failure leaves the row `failed`, counted in the
 * connection's health, until an admin presses Retry. The local change never waits for, or fails with, the shop.
 */
final class PushShopUpdateTest extends ApiTestCase
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

    public function testProcessedIsPushedAsProcessingAndRecordedOnTheLink(): void
    {
        [$connection, $orderId] = $this->aLinkedOrder();

        $this->changeStatus($orderId, Order::STATUS_PROCESSED);

        $this->assertStatus(200);
        self::assertSame([['shop' => self::SHOP, 'call' => 'status', 'order' => '5501', 'value' => 'processing']], FakeShopGateway::writes());
        $rows = $this->outbox();
        self::assertCount(1, $rows);
        self::assertSame([ShopCapability::OrderStatus, ShopOutbox::STATUS_SENT, 1, $connection], [$rows[0]->capability(), $rows[0]->status(), $rows[0]->attempts(), $rows[0]->connection()->id()]);
        self::assertSame('processing', $rows[0]->payload()['status'] ?? null);
        self::assertSame('processing', $this->link($orderId)->pushedStatus());
    }

    public function testSentAndDeliveredArePushedAsCompletedOnce(): void
    {
        [, $orderId] = $this->aLinkedOrder();

        $this->changeStatus($orderId, Order::STATUS_SENT);
        $this->changeStatus($orderId, Order::STATUS_DELIVERED);

        self::assertSame(['completed'], array_column(FakeShopGateway::writes(), 'value'), 'Delivered is `completed` too, which the shop already has: not pushed twice.');
        self::assertSame('completed', $this->link($orderId)->pushedStatus());
    }

    public function testShippingTheWholeOrderMarksItSentAndPushesCompleted(): void
    {
        [, $orderId] = $this->aLinkedOrder();
        $lines = array_map(
            static fn ($line) => ['uuid' => $line->getProduct()?->getUuid(), 'quantity' => $line->getQuantity()],
            $this->order($orderId)->getOrderProducts()->toArray(),
        );
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $this->sendJson('POST', "/api/v1/orders/{$orderId}/partials", ['items' => $lines]);

        $this->assertStatus(200);
        self::assertSame(['completed'], array_column(FakeShopGateway::writes(), 'value'), 'Sent through getting ready, as by hand.');
    }

    public function testTheOtherStatusesTouchNothing(): void
    {
        [, $orderId] = $this->aLinkedOrder();

        foreach ([Order::STATUS_CREATED, Order::STATUS_COMPLETED, Order::STATUS_PARTIAL] as $status) {
            $this->changeStatus($orderId, $status);
            $this->assertStatus(200);
        }

        self::assertSame([], FakeShopGateway::writes());
        self::assertSame([], $this->outbox(), 'Nothing is queued for a status the shop has no word for.');
    }

    public function testAnOrderWithoutAShopIsNotPushed(): void
    {
        $warehouse = $this->aWarehouse('Usa');
        $product = $this->aProduct('KF-01', $warehouse);
        $this->aConnection($warehouse);
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $orderId = $this->placeOrder($warehouse, $this->aCustomer(), [[$product, 1]]);

        $this->changeStatus($orderId, Order::STATUS_PROCESSED);

        $this->assertStatus(200);
        self::assertSame([], $this->outbox(), 'Typed by hand: it has no shop.');
    }

    public function testAConnectionWithoutTheCapabilityOrInactiveIsNotPushed(): void
    {
        [$connection, $orderId, $warehouse] = $this->aLinkedOrder(['capabilities' => ['order_status' => false, 'order_note' => false]]);

        $this->changeStatus($orderId, Order::STATUS_PROCESSED);
        $this->signInAs(['ROLE_ADMIN']);
        $this->sendJson('PUT', "/api/v1/shops/{$connection}", ['active' => false, 'consumer_key' => '', 'consumer_secret' => ''] + self::connectionPayload($warehouse));
        $this->assertStatus(200, 'Deactivating it, capability on.');
        $this->changeStatus($orderId, Order::STATUS_SENT);

        self::assertSame([], $this->outbox(), 'Capability off, then inactive: the shop is not written.');
        self::assertSame([], FakeShopGateway::writes());
    }

    public function testAFailedPushIsTriedAgainAndTheThirdFailureLeavesItFailedInTheHealth(): void
    {
        [$connection, $orderId] = $this->aLinkedOrder();
        FakeShopGateway::failing(self::SHOP, 'Service Unavailable', 503);

        $this->changeStatus($orderId, Order::STATUS_PROCESSED);

        $this->assertStatus(200, 'The local change never waits for the shop.');
        self::assertSame(Order::STATUS_PROCESSED, $this->order($orderId)->getStatus());
        $row = $this->outbox()[0];
        self::assertSame([ShopOutbox::STATUS_PENDING, 1, 'Service Unavailable'], [$row->status(), $row->attempts(), $row->lastError()]);
        self::assertEquals(new \DateTimeImmutable('2026-10-06 10:01:00'), $row->nextAttemptAt(), 'Tried again a minute later.');

        $this->deliverQueued((int) $row->id());
        self::assertSame(1, $this->outbox()[0]->attempts(), 'A message that comes before its time (one Retry already sent) does nothing.');

        self::mockTime('2026-10-06 10:01:00');
        $this->deliverQueued((int) $row->id());
        $row = $this->outbox()[0];
        self::assertSame([ShopOutbox::STATUS_PENDING, 2], [$row->status(), $row->attempts()]);
        self::assertEquals(new \DateTimeImmutable('2026-10-06 10:06:00'), $row->nextAttemptAt(), 'Then five minutes later.');
        self::assertNull($this->connection($connection)->lastFailureAt(), 'A retry still on its way is not a failure of the connection yet.');

        self::mockTime('2026-10-06 10:06:00');
        $this->deliverQueued((int) $row->id());
        $row = $this->outbox()[0];
        self::assertSame([ShopOutbox::STATUS_FAILED, 3, null], [$row->status(), $row->attempts(), $row->nextAttemptAt()]);
        $health = $this->connection($connection);
        self::assertSame(['push_failed', 'Service Unavailable'], [$health->lastFailureCode(), $health->lastFailure()]);

        $this->signInAs(['ROLE_ADMIN']);
        $shop = $this->getJson("/api/v1/shops/{$connection}");
        self::assertSame(1, $shop['health']['failed_pushes'], 'Counted in the connection\'s health.');
        $failed = $this->getJson("/api/v1/shops/{$connection}/outbox?status=failed");
        $this->assertStatus(200);
        self::assertSame([[
            'id' => $row->id(),
            'capability' => 'order_status',
            'order' => ['id' => $orderId, 'code' => '5501'],
            'payload' => ['status' => 'processing'],
            'status' => 'failed',
            'attempts' => 3,
            'last_error' => 'Service Unavailable',
            'created_at' => '2026-10-06T10:00:00-05:00',
        ]], $failed);
        self::assertSame([], FakeShopGateway::writes());
    }

    public function testRetryQueuesAFailedPushAgain(): void
    {
        [$connection, $orderId] = $this->aLinkedOrder();
        $id = $this->aFailedPush($orderId);
        FakeShopGateway::reset();
        FakeShopGateway::shop(self::SHOP, 'ck_live_key', 'cs_live_secret');
        $this->signInAs(['ROLE_ADMIN']);

        $retried = $this->sendJson('POST', "/api/v1/shops/{$connection}/outbox/{$id}/retry");

        $this->assertStatus(200);
        self::assertSame(['sent', 4], [$retried['status'], $retried['attempts']], 'Queued again and, on sync://, pushed at once.');
        self::assertSame(['processing'], array_column(FakeShopGateway::writes(), 'value'));
        self::assertSame([], $this->getJson("/api/v1/shops/{$connection}/outbox?status=failed"));
    }

    public function testARetryThatFailsAgainIsFailedAtOnce(): void
    {
        [$connection, $orderId] = $this->aLinkedOrder();
        $id = $this->aFailedPush($orderId);
        $this->signInAs(['ROLE_ADMIN']);

        $retried = $this->sendJson('POST', "/api/v1/shops/{$connection}/outbox/{$id}/retry");

        $this->assertStatus(200);
        self::assertSame(['failed', 4], [$retried['status'], $retried['attempts']], 'One more try by hand, no new series of retries.');
    }

    public function testRetryOfAnotherConnectionsPushIsNotFoundAndNeedsAnAdmin(): void
    {
        [, $orderId, $warehouse] = $this->aLinkedOrder();
        $id = $this->aFailedPush($orderId);
        $other = $this->aConnection($warehouse, ['name' => 'Other', 'site_url' => 'https://other.example.com']);

        $this->sendJson('POST', "/api/v1/shops/{$other['id']}/outbox/{$id}/retry");
        $this->assertStatus(404);
        self::assertSame('outbox_not_found', $this->body()['error'] ?? null);

        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $this->sendJson('POST', "/api/v1/shops/{$other['id']}/outbox/{$id}/retry");
        $this->assertStatus(403);
        $this->getJson("/api/v1/shops/{$other['id']}/outbox");
        $this->assertStatus(403);
    }

    public function testTheOutboxListRefusesAnUnknownStatus(): void
    {
        [$connection] = $this->aLinkedOrder();
        $this->signInAs(['ROLE_ADMIN']);

        $this->getJson("/api/v1/shops/{$connection}/outbox?status=lost");

        $this->assertStatus(422);
    }

    public function testKeysThatCannotWriteAreNamedInTheHealthAtTheFirstRefusal(): void
    {
        [$connection, $orderId] = $this->aLinkedOrder();
        FakeShopGateway::failing(self::SHOP, 'Sorry, you cannot edit this resource.', 401);

        $this->changeStatus($orderId, Order::STATUS_PROCESSED);

        self::assertSame('keys_read_only', $this->connection($connection)->lastFailureCode(), 'Read-only keys (README): "Test connection" reports can_write false from now on.');
    }

    public function testAnOrderNoteSentToTheShopIsPushedAsAPrivateNote(): void
    {
        [$connection, $orderId] = $this->aLinkedOrder(['capabilities' => ['order_status' => false, 'order_note' => true]]);
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $this->sendJson('POST', "/api/v1/orders/{$orderId}/comments", ['content' => 'Shipped today', 'send_to_shop' => true]);

        $this->assertStatus(201);
        self::assertSame([['shop' => self::SHOP, 'call' => 'note', 'order' => '5501', 'value' => 'Shipped today']], FakeShopGateway::writes());
        self::assertSame([ShopCapability::OrderNote, ShopOutbox::STATUS_SENT], [$this->outbox()[0]->capability(), $this->outbox()[0]->status()]);
        self::assertNull($this->connection($connection)->lastFailureAt());
    }

    /**
     * An order placed through a connection's webhook (linked to it, shop id 5501), with the fake shop answering.
     *
     * @param array<string, mixed> $overrides the connection's
     *
     * @return array{int, int, Warehouse} the connection's id, the order's id, its warehouse
     */
    private function aLinkedOrder(array $overrides = []): array
    {
        $warehouse = $this->aWarehouse('Usa');
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        $connection = $this->aConnection($warehouse, $overrides + ['email_printer' => false]);
        FakeShopGateway::shop(self::SHOP, 'ck_live_key', 'cs_live_secret');
        $this->deliver(self::tokenOf($connection), self::shopOrder(5501), (string) $connection['webhook_secret']);
        $this->assertStatus(200);
        $this->em()->clear();
        $order = $this->em()->getRepository(Order::class)->findOneBy(['code' => '5501']) ?? throw new \LogicException('Not placed.');

        return [(int) $connection['id'], (int) $order->getId(), $warehouse];
    }

    /** The order's status push failed three times: its outbox row's id. */
    private function aFailedPush(int $orderId): int
    {
        FakeShopGateway::failing(self::SHOP, 'Service Unavailable', 503);
        $this->changeStatus($orderId, Order::STATUS_PROCESSED);
        $id = (int) $this->outbox()[0]->id();
        self::mockTime('2026-10-06 10:01:00');
        $this->deliverQueued($id);
        self::mockTime('2026-10-06 10:06:00');
        $this->deliverQueued($id);
        self::assertSame(ShopOutbox::STATUS_FAILED, $this->outbox()[0]->status());

        return $id;
    }

    private function changeStatus(int $orderId, int $status): void
    {
        $this->signInAs(['ROLE_UPDATE_ORDERS']);
        $this->sendJson('POST', "/api/v1/orders/{$orderId}/status", ['status' => $status]);
    }

    /** What the worker does when the queued message's delay is over. */
    private function deliverQueued(int $outboxId): void
    {
        static::getContainer()->get(CommandBus::class)->dispatch(new PushShopUpdate($outboxId));
    }

    /**
     * @return list<ShopOutbox>
     */
    private function outbox(): array
    {
        $this->em()->clear();

        return $this->em()->getRepository(ShopOutbox::class)->findBy([], ['id' => 'ASC']);
    }

    private function link(int $orderId): ShopOrderLink
    {
        $this->em()->clear();

        return $this->em()->getRepository(ShopOrderLink::class)->findOneBy(['order' => $orderId]) ?? throw new \LogicException('Not linked.');
    }

    private function order(int $orderId): Order
    {
        $this->em()->clear();

        return $this->em()->find(Order::class, $orderId) ?? throw new \LogicException('No order '.$orderId);
    }
}
