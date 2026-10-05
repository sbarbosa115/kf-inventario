<?php

namespace App\Tests\Functional\Ordering;

use App\Customers\Domain\Model\Customer;
use App\Customers\Domain\Model\CustomerAddress;
use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Domain\Model\Order;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Monolog\Handler\TestHandler;
use Symfony\Component\Mime\Email;

/**
 * POST /api/v1/orders/sync, the "Sync Orders" button: pulls the orders the WooCommerce shops have waiting and places
 * the new ones exactly as the webhook would (same mapper, same warehouse by shop address, same printer rule). An order
 * already imported (its shop id is an order code in that warehouse) is skipped, so pressing it twice changes nothing.
 * The shops are a fake (FakeRemoteOrderSource): tests never call a real one.
 */
final class SyncOrdersApiTest extends ApiTestCase
{
    use OrderingFixtures;
    use SignsIn;

    private const URL = '/api/v1/orders/sync';

    protected function setUp(): void
    {
        parent::setUp();
        FakeRemoteOrderSource::reset();
    }

    public function testNewRemoteOrdersArePlacedInTheWarehouseOfTheirShopWithCustomerAndAddresses(): void
    {
        $warehouse = $this->aWarehouse('Usa', ['https://usa.test']);
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        FakeRemoteOrderSource::shopWith('https://usa.test', [self::remoteOrder(5501), self::remoteOrder(5502, 'luis@example.com')]);
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $answer = $this->sendJson('POST', self::URL);

        $this->assertStatus(202);
        self::assertSame(['imported' => 2, 'skipped' => 0], $answer);
        $this->em()->clear();
        $order = $this->em()->getRepository(Order::class)->findOneBy(['code' => '5501']);
        self::assertNotNull($order, 'The shop order id is the order code, as the webhook stores it.');
        self::assertSame($warehouse->getId(), $order->getWarehouse()?->getId(), 'The warehouse whose urls hold the shop.');
        self::assertSame([Order::SOURCE_WEB, Order::STATUS_CREATED, Order::PAYMENT_CREDIT_CARD, ''], [$order->getSource(), $order->getStatus(), $order->getPaymentMethod(), $order->getComment()]);
        self::assertSame([['KF-01', 2], ['KF-02', 1]], array_map(static fn ($line) => [$line->getProduct()?->getCode(), $line->getQuantity()], $order->getOrderProducts()->toArray()), 'Line items by SKU.');
        $customer = $order->getCustomer();
        self::assertInstanceOf(Customer::class, $customer);
        self::assertSame(['ana@example.com', 'Ana', 'Gomez', '555-0100'], [$customer->getEmail(), $customer->getFirstName(), $customer->getLastName(), $customer->getPhone()]);
        self::assertSame(
            [[CustomerAddress::ADDRESS_BILLING, '1 Billing St', 'Miami'], [CustomerAddress::ADDRESS_SHIPPING, '2 Shipping Ave', 'New York']],
            array_map(static fn (CustomerAddress $a) => [$a->getAddressType(), $a->getAddress(), $a->getCity()?->getName()], $customer->getAddresses()->toArray()),
            'Billing and shipping, as the webhook maps them.',
        );
        self::assertNotNull($this->em()->getRepository(Order::class)->findOneBy(['code' => '5502']));
    }

    public function testAnOrderAlreadyImportedIsSkippedSoSyncingTwiceChangesNothing(): void
    {
        $warehouse = $this->aWarehouse('Usa', ['https://usa.test']);
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        FakeRemoteOrderSource::shopWith('https://usa.test', [self::remoteOrder(5501), self::remoteOrder(5502)]);
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $this->sendJson('POST', self::URL);
        $this->assertStatus(202);
        $again = $this->sendJson('POST', self::URL);

        $this->assertStatus(202);
        self::assertSame(['imported' => 0, 'skipped' => 2], $again, 'Both orders were imported by the first sync.');
        $this->em()->clear();
        self::assertSame(1, $this->em()->getRepository(Order::class)->count(['code' => '5501']), 'Still one order 5501.');
        self::assertSame(2, $this->em()->getRepository(Order::class)->count([]));
    }

    public function testAnOrderTheWebhookAlreadyPlacedIsSkipped(): void
    {
        $warehouse = $this->aWarehouse('Usa', ['https://usa.test']);
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        $this->client->request('POST', '/admin/order/1H39j0jpQPsWL958v9R4', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_X-WC-Webhook-Source' => 'https://usa.test'], content: json_encode(self::remoteOrder(5501), \JSON_THROW_ON_ERROR));
        $this->assertStatus(200);
        FakeRemoteOrderSource::shopWith('https://usa.test', [self::remoteOrder(5501), self::remoteOrder(5502)]);
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $answer = $this->sendJson('POST', self::URL);

        $this->assertStatus(202);
        self::assertSame(['imported' => 1, 'skipped' => 1], $answer, 'The webhook and the pull store the same code: one order each.');
        $this->em()->clear();
        self::assertSame(1, $this->em()->getRepository(Order::class)->count(['code' => '5501']));
    }

    public function testADeletedOrderIsNotBroughtBack(): void
    {
        $warehouse = $this->aWarehouse('Usa', ['https://usa.test']);
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        FakeRemoteOrderSource::shopWith('https://usa.test', [self::remoteOrder(5501)]);
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $this->sendJson('POST', self::URL);
        $this->assertStatus(202);
        $this->em()->clear();
        $id = $this->em()->getRepository(Order::class)->findOneBy(['code' => '5501'])?->getId();
        $this->sendJson('DELETE', '/api/v1/orders/'.$id);
        $this->assertStatus(204);

        $answer = $this->sendJson('POST', self::URL);

        $this->assertStatus(202);
        self::assertSame(['imported' => 0, 'skipped' => 1], $answer, 'Someone deleted it on purpose: the next sync must not place it again.');
    }

    public function testTheSameShopIdInAnotherWarehouseIsStillImported(): void
    {
        $usa = $this->aWarehouse('Usa', ['https://usa.test']);
        $colombia = $this->aWarehouse('Colombia', ['https://colombia.test']);
        $this->aProduct('KF-01', $usa);
        $this->aProduct('KF-02', $usa);
        FakeRemoteOrderSource::shopWith('https://usa.test', [self::remoteOrder(5501)]);
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $this->sendJson('POST', self::URL);
        $this->assertStatus(202);
        FakeRemoteOrderSource::shopWith('https://colombia.test', [self::remoteOrder(5501)]);

        $answer = $this->sendJson('POST', self::URL);

        $this->assertStatus(202);
        self::assertSame(['imported' => 1, 'skipped' => 1], $answer, 'Order 5501 of the Colombian shop is not order 5501 of the American one.');
        $this->em()->clear();
        self::assertSame(1, $this->em()->getRepository(Order::class)->count(['code' => '5501', 'warehouse' => $colombia->getId()]));
    }

    public function testAWarehouseWhoseShopTheAppHasNoKeysForIsNotPulled(): void
    {
        $usa = $this->aWarehouse('Usa', ['https://usa.test']);
        $colombia = $this->aWarehouse('Colombia', ['https://colombia.test']);
        $this->aProduct('KF-01', $usa);
        $this->aProduct('KF-02', $usa);
        FakeRemoteOrderSource::shopWith('https://usa.test', [self::remoteOrder(5501)]);
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $answer = $this->sendJson('POST', self::URL);

        $this->assertStatus(202);
        self::assertSame(['imported' => 1, 'skipped' => 0], $answer);
        self::assertSame(['https://usa.test'], FakeRemoteOrderSource::asked(), 'Only the shops the app holds keys for are read.');
        $this->em()->clear();
        self::assertSame(0, $this->em()->getRepository(Order::class)->count(['warehouse' => $colombia->getId()]));
    }

    public function testAShopNoWarehouseReceivesIsLoggedAndNotPulled(): void
    {
        $this->aWarehouse('Usa', ['https://usa.test']);
        FakeRemoteOrderSource::shopWith('https://unknown.test', [self::remoteOrder(5501)]);
        $logs = $this->logHandler();
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $answer = $this->sendJson('POST', self::URL);

        $this->assertStatus(202);
        self::assertSame(['imported' => 0, 'skipped' => 0], $answer);
        self::assertSame([], FakeRemoteOrderSource::asked(), 'Its orders would have nowhere to go.');
        self::assertTrue($logs->hasWarningThatContains('https://unknown.test'), 'Why nothing came from that shop is logged.');
    }

    public function testAShopAddressWrittenWithoutItsTrailingSlashStillFindsItsWarehouse(): void
    {
        $warehouse = $this->aWarehouse('Usa', ['https://usa.test/']);
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        FakeRemoteOrderSource::shopWith('https://usa.test', [self::remoteOrder(5501)]);
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $answer = $this->sendJson('POST', self::URL);

        $this->assertStatus(202);
        self::assertSame(['imported' => 1, 'skipped' => 0], $answer, 'WooCommerce sends its webhook source with a trailing slash; the keys may be written without.');
    }

    public function testAnOrderThatCannotBePlacedIsSkippedAndLoggedAndTheOthersArePlaced(): void
    {
        $warehouse = $this->aWarehouse('Usa', ['https://usa.test']);
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        $unknownSku = self::remoteOrder(5501, 'nobody@example.com');
        $unknownSku['line_items'] = [['sku' => 'NOT-A-PRODUCT', 'quantity' => 1]];
        $noLines = self::remoteOrder(5502, 'nobody@example.com');
        $noLines['line_items'] = [];
        FakeRemoteOrderSource::shopWith('https://usa.test', [$unknownSku, $noLines, ['id' => 5503], self::remoteOrder(5504)]);
        $logs = $this->logHandler();
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $answer = $this->sendJson('POST', self::URL);

        $this->assertStatus(202);
        self::assertSame(['imported' => 1, 'skipped' => 3], $answer);
        $this->em()->clear();
        self::assertNotNull($this->em()->getRepository(Order::class)->findOneBy(['code' => '5504']));
        self::assertSame(0, $this->em()->getRepository(Customer::class)->count(['email' => 'nobody@example.com']), 'An order that is not placed leaves no customer behind.');
        self::assertTrue($logs->hasErrorThatContains('5501'), 'Why an order was not placed is logged, as the webhook does.');
    }

    public function testOnlyTheConfiguredWarehouseEmailsThePrinter(): void
    {
        $first = $this->withId($this->aWarehouse('Colombia', ['https://colombia.test']), 1);
        $this->withId($this->aWarehouse('Usa', ['https://usa.test']), 2);
        $this->aProduct('KF-01', $first);
        $this->aProduct('KF-02', $first);
        FakeRemoteOrderSource::shopWith('https://colombia.test', [self::remoteOrder(5601)]);
        FakeRemoteOrderSource::shopWith('https://usa.test', [self::remoteOrder(5602)]);
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $this->sendJson('POST', self::URL);

        $this->assertStatus(202);
        self::assertEmailCount(1, message: 'Warehouse 1 prints its orders (ORDER_WEBHOOK_EMAIL_WAREHOUSE_ID); warehouse 2 does not.');
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        self::assertSame('Order #5601 was created', $email->getSubject());
    }

    public function testAShopThatCannotBeReadAnswers502AndKeepsNothing(): void
    {
        $usa = $this->aWarehouse('Usa', ['https://usa.test']);
        $this->aWarehouse('Colombia', ['https://colombia.test']);
        $this->aProduct('KF-01', $usa);
        $this->aProduct('KF-02', $usa);
        FakeRemoteOrderSource::shopWith('https://usa.test', [self::remoteOrder(5501)]);
        FakeRemoteOrderSource::failingShop('https://colombia.test');
        $this->signInAs(['ROLE_MANAGE_ORDERS']);

        $answer = $this->sendJson('POST', self::URL);

        $this->assertStatus(502);
        self::assertSame('order_sync_failed', $answer['error'] ?? null);
        $this->em()->clear();
        self::assertSame(0, $this->em()->getRepository(Order::class)->count([]), 'All or nothing: pressing Sync again imports everything once.');
        self::assertEmailCount(0);
    }

    public function testSyncingNeedsTheSyncRole(): void
    {
        $this->signInAs(['ROLE_UPDATE_ORDERS']);

        $answer = $this->sendJson('POST', self::URL);

        $this->assertStatus(403, 'ROLE_UPDATE_ORDERS reads and edits orders but does not reach ROLE_CAN_SYNC_ORDERS.');
        self::assertSame('forbidden', $answer['error'] ?? null);
        self::assertSame([], FakeRemoteOrderSource::asked());
    }

    /**
     * A WooCommerce order as the REST API returns it (the fields the mapper reads; the webhook posts the same JSON).
     *
     * @return array<string, mixed>
     */
    private static function remoteOrder(int $id, string $email = 'ana@example.com'): array
    {
        return [
            'id' => $id,
            'status' => 'processing',
            'billing' => ['first_name' => 'Ana', 'last_name' => 'Gomez', 'email' => $email, 'phone' => '555-0100', 'address_1' => '1 Billing St', 'postcode' => '33101', 'city' => 'Miami', 'state' => 'FL', 'country' => 'US'],
            'shipping' => ['first_name' => 'Ana', 'last_name' => 'Gomez', 'address_1' => '2 Shipping Ave', 'postcode' => '10001', 'city' => 'New York', 'state' => 'NY', 'country' => 'US'],
            'line_items' => [['sku' => 'KF-01', 'quantity' => 2], ['sku' => 'KF-02', 'quantity' => 1]],
        ];
    }

    /**
     * The test database's ids are not reset between tests: the warehouse id the email rule reads is set by hand.
     */
    private function withId(Warehouse $warehouse, int $id): Warehouse
    {
        $this->em()->getConnection()->executeStatement('UPDATE warehouse SET id = ? WHERE id = ?', [$id, $warehouse->getId()]);
        $this->em()->clear();

        return $this->em()->find(Warehouse::class, $id) ?? throw new \LogicException('No warehouse '.$id);
    }

    private function logHandler(): TestHandler
    {
        $logger = static::getContainer()->get('logger');
        $handler = new TestHandler();
        $logger->pushHandler($handler);

        return $handler;
    }
}
