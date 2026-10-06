<?php

namespace App\Tests\Functional\Ordering;

use App\Ordering\Domain\Model\Order;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mime\Email;

/**
 * POST /api/v1/orders/sync, "Check now" (docs/pdr/prd-shops-settings.md, Decisions 11): the catch-up pull of every
 * active connection at once, due or not, each in its own transaction. The answer says what each connection brought
 * in; a shop that cannot be read fails that connection only (recorded in its health), and the whole check answers 502
 * order_sync_failed only when every connection failed. The shops are a fake (FakeShopGateway).
 */
final class SyncOrdersApiTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OrderingFixtures;
    use ShopConnections;
    use SignsIn;

    private const URL = '/api/v1/orders/sync';

    protected function setUp(): void
    {
        parent::setUp();
        FakeShopGateway::reset();
        self::mockTime('2026-10-06 10:00:00');
    }

    public function testEveryActiveConnectionIsPulledAndTheAnswerSaysWhatEachBroughtIn(): void
    {
        [$usa, $colombia] = $this->twoShops();
        FakeShopGateway::shop('https://usa.example.com', 'ck_live_key', 'cs_live_secret', [self::shopOrder(5501), self::shopOrder(5502)]);
        FakeShopGateway::shop('https://colombia.example.com', 'ck_live_key', 'cs_live_secret', [self::shopOrder(7001)]);
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $answer = $this->sendJson('POST', self::URL);

        $this->assertStatus(202);
        self::assertSame([
            'imported' => 3,
            'skipped' => 0,
            'failed' => 0,
            'connections' => [
                ['id' => $colombia, 'name' => 'Colombia shop', 'imported' => 1, 'skipped' => 0, 'error' => null],
                ['id' => $usa, 'name' => 'Usa shop', 'imported' => 2, 'skipped' => 0, 'error' => null],
            ],
        ], $answer, 'By name, as the connections are listed.');
        $this->em()->clear();
        self::assertSame('Colombia', $this->em()->getRepository(Order::class)->findOneBy(['code' => '7001'])?->getWarehouse()?->getName());
    }

    public function testPressingItTwiceImportsNothingTheSecondTime(): void
    {
        $this->twoShops();
        FakeShopGateway::shop('https://usa.example.com', 'ck_live_key', 'cs_live_secret', [self::shopOrder(5501)]);
        FakeShopGateway::shop('https://colombia.example.com', 'ck_live_key', 'cs_live_secret');
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $this->sendJson('POST', self::URL);

        $again = $this->sendJson('POST', self::URL);

        $this->assertStatus(202);
        self::assertSame([0, 1, 0], [$again['imported'], $again['skipped'], $again['failed']], 'No cursor (the fake orders carry no date_modified_gmt): read again, already in the app.');
        self::assertCount(4, FakeShopGateway::reads(), 'Check now reads every connection each time, due or not.');
    }

    public function testAShopThatCannotBeReadFailsThatConnectionOnly(): void
    {
        [$usa, $colombia] = $this->twoShops();
        FakeShopGateway::shop('https://usa.example.com', 'ck_live_key', 'cs_live_secret', [self::shopOrder(5501)]);
        FakeShopGateway::failing('https://colombia.example.com', 'Connection refused');
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $answer = $this->sendJson('POST', self::URL);

        $this->assertStatus(202);
        self::assertSame([1, 0, 1], [$answer['imported'], $answer['skipped'], $answer['failed']]);
        self::assertSame(['id' => $colombia, 'name' => 'Colombia shop', 'imported' => 0, 'skipped' => 0, 'error' => 'Connection refused'], $answer['connections'][0]);
        $this->em()->clear();
        self::assertNotNull($this->em()->getRepository(Order::class)->findOneBy(['code' => '5501']), 'The other shop\'s order is kept.');
        self::assertSame('pull_failed', $this->connection($colombia)->lastFailureCode(), 'In the failing connection\'s health.');
        self::assertNull($this->connection($usa)->lastFailureCode());
    }

    public function testWhenEveryConnectionFailsTheCheckAnswers502(): void
    {
        $this->twoShops();
        FakeShopGateway::failing('https://usa.example.com');
        FakeShopGateway::failing('https://colombia.example.com');
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $answer = $this->sendJson('POST', self::URL);

        $this->assertStatus(502);
        self::assertSame('order_sync_failed', $answer['error'] ?? null);
        self::assertStringContainsString('Colombia shop', (string) ($answer['message'] ?? ''));
    }

    public function testWithoutAnActiveConnectionNothingIsPulled(): void
    {
        $warehouse = $this->aWarehouse('Usa');
        $this->aConnection($warehouse, ['active' => false]);
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $answer = $this->sendJson('POST', self::URL);

        $this->assertStatus(202);
        self::assertSame(['imported' => 0, 'skipped' => 0, 'failed' => 0, 'connections' => []], $answer, 'An inactive connection is not read; no connection pulls nothing, as empty keys did.');
        self::assertSame([], FakeShopGateway::reads());
    }

    public function testEachConnectionsPrinterSwitchSaysWhetherItsOrdersAreEmailed(): void
    {
        $this->twoShops();
        FakeShopGateway::shop('https://usa.example.com', 'ck_live_key', 'cs_live_secret', [self::shopOrder(5601)]);
        FakeShopGateway::shop('https://colombia.example.com', 'ck_live_key', 'cs_live_secret', [self::shopOrder(5602)]);
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $this->sendJson('POST', self::URL);

        $this->assertStatus(202);
        self::assertEmailCount(1, message: 'Only the Colombian connection prints its orders.');
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        self::assertSame('Order #5602 was created', $email->getSubject());
    }

    public function testCheckingNeedsTheSyncRole(): void
    {
        $this->signInAs(['ROLE_UPDATE_ORDERS']);

        $answer = $this->sendJson('POST', self::URL);

        $this->assertStatus(403, 'ROLE_UPDATE_ORDERS reads and edits orders but does not reach ROLE_CAN_SYNC_ORDERS.');
        self::assertSame('forbidden', $answer['error'] ?? null);
        self::assertSame([], FakeShopGateway::reads());
    }

    /**
     * "Usa shop" → Usa (does not print) and "Colombia shop" → Colombia (prints); KF-01 and KF-02 exist.
     *
     * @return array{int, int} their ids
     */
    private function twoShops(): array
    {
        $usa = $this->aWarehouse('Usa');
        $colombia = $this->aWarehouse('Colombia');
        $this->aProduct('KF-01', $usa);
        $this->aProduct('KF-02', $usa);

        return [
            (int) $this->aConnection($usa, ['name' => 'Usa shop', 'site_url' => 'https://usa.example.com', 'email_printer' => false])['id'],
            (int) $this->aConnection($colombia, ['name' => 'Colombia shop', 'site_url' => 'https://colombia.example.com', 'email_printer' => true])['id'],
        ];
    }
}
