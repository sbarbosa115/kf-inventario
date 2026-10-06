<?php

namespace App\Tests\Functional\Ordering;

use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Domain\Model\ShopDelivery;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

/**
 * php bin/console app:shops:pull [--if-due] (docs/pdr/prd-shops-settings.md, Decisions 11): the cron line runs it
 * every minute with --if-due, so a connection is read 15 minutes after its last pull (successful or not); without the
 * option every active connection is read. Each run also deletes the failed deliveries received more than 90 days ago
 * (they hold customers' data: Security, "Inbox payloads"). A shop that cannot be read never fails the cron line.
 */
final class PullShopsCommandTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OrderingFixtures;
    use ShopConnections;
    use SignsIn;

    protected function setUp(): void
    {
        parent::setUp();
        FakeShopGateway::reset();
        self::mockTime('2026-10-06 10:00:00');
    }

    public function testWithIfDueOnlyTheConnectionsLastPulledFifteenMinutesAgoOrNeverAreRead(): void
    {
        $warehouse = $this->aWarehouse('Usa');
        $recent = $this->aShop($warehouse, 'Recent', '2026-10-06 09:46:00');
        $due = $this->aShop($warehouse, 'Due', '2026-10-06 09:45:00');
        $never = $this->aShop($warehouse, 'Never', null);
        $this->aShop($warehouse, 'Inactive', null, false);

        $tester = $this->pull(['--if-due' => true]);

        self::assertSame(Command::SUCCESS, $tester->getStatusCode());
        self::assertEqualsCanonicalizing(['https://due.example.com', 'https://never.example.com'], array_column(FakeShopGateway::reads(), 'shop'), '14 minutes is not due; 15 is; never pulled is; inactive never is.');
        self::assertEquals(new \DateTimeImmutable('2026-10-06 10:00:00'), $this->connection($due)->lastPullAt());
        self::assertEquals(new \DateTimeImmutable('2026-10-06 10:00:00'), $this->connection($never)->lastPullAt());
        self::assertEquals(new \DateTimeImmutable('2026-10-06 09:46:00'), $this->connection($recent)->lastPullAt());
    }

    public function testWithoutIfDueEveryActiveConnectionIsRead(): void
    {
        $warehouse = $this->aWarehouse('Usa');
        $this->aShop($warehouse, 'Recent', '2026-10-06 09:59:00');
        $this->aShop($warehouse, 'Never', null);

        $this->pull([]);

        self::assertCount(2, FakeShopGateway::reads());
    }

    public function testAShopThatCannotBeReadDoesNotFailTheCronLine(): void
    {
        $warehouse = $this->aWarehouse('Usa');
        $this->aShop($warehouse, 'Down', null);
        $this->aShop($warehouse, 'Up', null);
        FakeShopGateway::failing('https://down.example.com', 'Connection refused');

        $tester = $this->pull(['--if-due' => true]);

        self::assertSame(Command::SUCCESS, $tester->getStatusCode());
        self::assertStringContainsString('Down: Connection refused', $tester->getDisplay());
        self::assertCount(2, FakeShopGateway::reads(), 'The next connection is still read.');
    }

    public function testFailedDeliveriesReceivedMoreThanNinetyDaysAgoArePurged(): void
    {
        $warehouse = $this->aWarehouse('Usa');
        $id = $this->aShop($warehouse, 'Kfvintage', '2026-10-06 09:59:00');
        $old = $this->aDelivery($id, '2026-07-07 09:59:00');
        $kept = $this->aDelivery($id, '2026-07-08 10:00:00');

        $this->pull(['--if-due' => true]);

        $left = array_map(static fn (ShopDelivery $d) => $d->id(), $this->deliveries());
        self::assertSame([$kept], $left, "91 days old ({$old}) goes; 90 days stays.");
        self::assertSame([], FakeShopGateway::reads(), 'Nothing was due: the purge runs anyway.');
    }

    /**
     * @param array<string, mixed> $options
     */
    private function pull(array $options): CommandTester
    {
        $tester = new CommandTester((new Application($this->client->getKernel()))->find('app:shops:pull'));
        $tester->execute($options);

        return $tester;
    }

    private function aShop(Warehouse $warehouse, string $name, ?string $lastPullAt, bool $active = true): int
    {
        $url = 'https://'.strtolower($name).'.example.com';
        $id = (int) $this->aConnection($warehouse, ['name' => $name, 'site_url' => $url, 'active' => $active])['id'];
        FakeShopGateway::shop($url, 'ck_live_key', 'cs_live_secret');
        $this->em()->getConnection()->executeStatement('UPDATE shop_connection SET last_pull_at = ? WHERE id = ?', [$lastPullAt, $id]);
        $this->em()->clear();

        return $id;
    }

    private function aDelivery(int $connectionId, string $receivedAt): int
    {
        $delivery = new ShopDelivery($this->connection($connectionId), ShopDelivery::KIND_WEBHOOK, '5501', ShopDelivery::REASON_UNKNOWN_PRODUCT, 'Unknown product KF-99', '{}', new \DateTimeImmutable($receivedAt));
        $this->em()->persist($delivery);
        $this->em()->flush();

        return (int) $delivery->id();
    }
}
