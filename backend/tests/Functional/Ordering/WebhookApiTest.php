<?php

namespace App\Tests\Functional\Ordering;

use App\Customers\Domain\Model\Country;
use App\Customers\Domain\Model\Customer;
use App\Customers\Domain\Model\CustomerAddress;
use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderStatus;
use App\Settings\Domain\Model\AppSetting;
use App\Tests\Support\ApiTestCase;
use Monolog\Handler\TestHandler;
use Symfony\Component\Mime\Email;

/**
 * The WooCommerce webhook (legacy OrderController::createWebhook + WooCommerceProvider): the shops post their new
 * orders to an unchanged, public URL; the warehouse is the one whose `urls` hold the X-WC-Webhook-Source; the printer
 * gets the email only for warehouse ORDER_WEBHOOK_EMAIL_WAREHOUSE_ID (1); the shop always gets {status: true}.
 */
final class WebhookApiTest extends ApiTestCase
{
    use OrderingFixtures;

    private const URL = '/admin/order/1H39j0jpQPsWL958v9R4';

    public function testAShopOrderIsPlacedInTheWarehouseOfItsSourceWithBillingAndShippingAddresses(): void
    {
        $warehouse = $this->aWarehouse('Usa', ['https://usa.test']);
        $this->aWarehouse('Colombia', ['https://colombia.test']);
        $a = $this->aProduct('KF-01', $warehouse);
        $b = $this->aProduct('KF-02', $warehouse);

        $answer = $this->postWebhook('https://usa.test', self::payload());

        $this->assertStatus(200);
        self::assertSame(['status' => true], $answer);
        $this->em()->clear();
        $order = $this->em()->getRepository(Order::class)->findOneBy(['code' => '5501']);
        self::assertNotNull($order, 'The shop order id is the order code.');
        self::assertSame($warehouse->getId(), $order->getWarehouse()?->getId(), 'The warehouse whose urls hold the source.');
        self::assertSame(Order::SOURCE_WEB, $order->getSource());
        self::assertSame(Order::STATUS_CREATED, $order->getStatus());
        self::assertSame(Order::PAYMENT_CREDIT_CARD, $order->getPaymentMethod());
        self::assertSame('', $order->getComment());
        self::assertSame([['KF-01', 2], ['KF-02', 1]], array_map(static fn ($line) => [$line->getProduct()?->getCode(), $line->getQuantity()], $order->getOrderProducts()->toArray()), 'Line items by SKU.');
        self::assertSame(1, $this->em()->getRepository(OrderStatus::class)->count(['order' => $order->getId()]));

        $customer = $order->getCustomer();
        self::assertInstanceOf(Customer::class, $customer);
        self::assertSame(['ana@example.com', 'Ana', 'Gomez', '555-0100'], [$customer->getEmail(), $customer->getFirstName(), $customer->getLastName(), $customer->getPhone()]);
        $addresses = $customer->getAddresses()->toArray();
        self::assertCount(2, $addresses, 'Billing and shipping, two addresses.');
        // The shop sends state and country codes: Customers' rule (CustomerRegistry) finds the existing state and
        // country by code instead of creating a "FL" state and a "US" country beside them.
        self::assertSame([CustomerAddress::ADDRESS_BILLING, '1 Billing St', '33101', 'Miami', 'Florida', 'United States'], self::address($addresses[0]));
        self::assertSame([CustomerAddress::ADDRESS_SHIPPING, '2 Shipping Ave', '10001', 'New York', 'New York', 'United States'], self::address($addresses[1]));
        self::assertSame(1, $this->em()->getRepository(Country::class)->count(['code' => 'US']), 'No second United States is created.');
        self::assertNotNull($b->getId());
        self::assertNotNull($a->getId());
    }

    public function testOnlyTheConfiguredWarehouseEmailsThePrinter(): void
    {
        $first = $this->withId($this->aWarehouse('Colombia', ['https://colombia.test']), 1);
        $this->withId($this->aWarehouse('Usa', ['https://usa.test']), 2);
        $this->aProduct('KF-01', $first);
        $this->aProduct('KF-02', $first);

        $this->postWebhook('https://usa.test', self::payload(5601));
        $this->assertStatus(200);
        self::assertEmailCount(0, message: 'Warehouse 2: no email (ORDER_WEBHOOK_EMAIL_WAREHOUSE_ID is 1).');

        $this->postWebhook('https://colombia.test', self::payload(5602));
        $this->assertStatus(200);
        self::assertEmailCount(1, message: 'Warehouse 1: the printer gets it.');
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        self::assertSame('Order #5602 was created', $email->getSubject());
    }

    public function testAnUnknownSourceIsLoggedAndStillAnswersOk(): void
    {
        $this->aWarehouse('Usa', ['https://usa.test']);
        $logs = $this->logHandler();

        $answer = $this->postWebhook('https://unknown.test', self::payload());

        $this->assertStatus(200, 'The shop never sees an error: it would retry and then disable the webhook.');
        self::assertSame(['status' => true], $answer);
        $this->em()->clear();
        self::assertSame(0, $this->em()->getRepository(Order::class)->count([]));
        self::assertTrue($logs->hasErrorThatContains('Warehouse [https://unknown.test] was not found'), 'The unknown source is logged, as before.');
    }

    public function testAnOrderNamingAnUnknownSkuIsLoggedAndNotPlaced(): void
    {
        $this->aWarehouse('Usa', ['https://usa.test']);
        $logs = $this->logHandler();

        $answer = $this->postWebhook('https://usa.test', self::payload());

        $this->assertStatus(200);
        self::assertSame(['status' => true], $answer);
        $this->em()->clear();
        self::assertSame(0, $this->em()->getRepository(Order::class)->count([]));
        self::assertTrue($logs->hasErrorThatContains('WooCommerce order'), 'Why the order was not placed is logged.');
    }

    public function testTheWebhookNeedsNoSignIn(): void
    {
        $this->client->request('GET', self::URL, server: ['HTTP_X-WC-Webhook-Source' => 'https://unknown.test']);

        $this->assertStatus(200, 'Public: the shops do not sign in (GET too, as before).');
    }

    /**
     * WooCommerce may deliver an order twice (a retry, a resend from the shop): the second delivery places nothing,
     * as the sync skips an order it already has (RemoteOrderKey: the shop id is the code, per warehouse, deleted
     * orders included). The shop still gets {status: true}.
     */
    public function testTheSameOrderDeliveredTwiceIsPlacedAndPrintedOnce(): void
    {
        $warehouse = $this->withId($this->aWarehouse('Colombia', ['https://colombia.test']), 1);
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        // One kernel for both deliveries: the log handler below sees the second one.
        $this->client->disableReboot();
        $logs = $this->logHandler();

        $this->postWebhook('https://colombia.test', self::payload(5801));
        $this->assertStatus(200);
        self::assertEmailCount(1, message: 'The first delivery is printed.');
        $answer = $this->postWebhook('https://colombia.test', self::payload(5801));

        $this->assertStatus(200);
        self::assertSame(['status' => true], $answer);
        self::assertEmailCount(0, message: 'The second delivery is not printed again.');
        self::assertTrue($logs->hasInfoThatContains('5801'), 'The skipped delivery is logged.');
        $this->em()->clear();
        self::assertSame(1, $this->em()->getRepository(Order::class)->count(['code' => '5801']), 'One order, not two.');
    }

    public function testAnOrderDeletedInTheAppIsNotBroughtBackByTheWebhook(): void
    {
        $warehouse = $this->aWarehouse('Usa', ['https://usa.test']);
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        $this->postWebhook('https://usa.test', self::payload(5802));
        $this->em()->clear();
        $order = $this->em()->getRepository(Order::class)->findOneBy(['code' => '5802']);
        self::assertNotNull($order);
        $this->em()->remove($order);
        $this->em()->flush();

        $this->postWebhook('https://usa.test', self::payload(5802));

        $this->assertStatus(200);
        $this->em()->clear();
        $this->em()->getFilters()->disable('softdeleteable');
        self::assertSame(1, $this->em()->getRepository(Order::class)->count(['code' => '5802']), 'Deleted orders count as existing, as for the sync.');
    }

    public function testWithASecretASignedOrderIsPlaced(): void
    {
        $this->withWebhookSecret('s3cret');
        $warehouse = $this->aWarehouse('Usa', ['https://usa.test']);
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        $body = json_encode(self::payload(5701), \JSON_THROW_ON_ERROR);

        $this->client->request('POST', self::URL, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_X-WC-Webhook-Source' => 'https://usa.test', 'HTTP_X-WC-Webhook-Signature' => base64_encode(hash_hmac('sha256', $body, 's3cret', true))], content: $body);

        $this->assertStatus(200);
        $this->em()->clear();
        self::assertNotNull($this->em()->getRepository(Order::class)->findOneBy(['code' => '5701']), 'WooCommerce signs each delivery with the webhook secret: base64(HMAC-SHA256(body)).');
    }

    public function testWithASecretAnUnsignedOrForgedOrderIsLoggedAndNotPlaced(): void
    {
        $this->withWebhookSecret('s3cret');
        $warehouse = $this->aWarehouse('Usa', ['https://usa.test']);
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        $logs = $this->logHandler();
        $body = json_encode(self::payload(5702), \JSON_THROW_ON_ERROR);

        $this->client->request('POST', self::URL, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_X-WC-Webhook-Source' => 'https://usa.test'], content: $body);
        $this->assertStatus(200, 'The answer does not change: the shop (or whoever posted) still gets {status: true}.');
        self::assertSame(['status' => true], $this->body());
        $this->client->request('POST', self::URL, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_X-WC-Webhook-Source' => 'https://usa.test', 'HTTP_X-WC-Webhook-Signature' => base64_encode(hash_hmac('sha256', $body, 'wrong', true))], content: $body);
        $this->assertStatus(200);

        $this->em()->clear();
        self::assertSame(0, $this->em()->getRepository(Order::class)->count([]));
        self::assertTrue($logs->hasWarningThatContains('X-WC-Webhook-Signature'), 'A refused delivery is logged.');
    }

    /**
     * WOO_COMMERCE_WEBHOOK_SECRET is empty by default (no check, as before); these tests set it for their kernel.
     */
    private function withWebhookSecret(string $secret): void
    {
        $_SERVER['WOO_COMMERCE_WEBHOOK_SECRET'] = $_ENV['WOO_COMMERCE_WEBHOOK_SECRET'] = $secret;
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->client->disableReboot();
    }

    protected function tearDown(): void
    {
        $_SERVER['WOO_COMMERCE_WEBHOOK_SECRET'] = $_ENV['WOO_COMMERCE_WEBHOOK_SECRET'] = '';
        parent::tearDown();
    }

    public function testOnceTheLegacyUrlIsTurnedOffItAnswers410AndCountsTheHit(): void
    {
        $warehouse = $this->aWarehouse('Usa', ['https://usa.test']);
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        $this->save(new AppSetting('webhooks.legacy_enabled', '0', false, new \DateTimeImmutable()));

        $answer = $this->postWebhook('https://usa.test', self::payload());

        $this->assertStatus(410, 'The old URL is gone once every shop points at its connection (Decisions 8).');
        self::assertSame(['status' => false, 'error' => 'webhook_moved'], $answer);
        $this->em()->clear();
        self::assertNull($this->em()->getRepository(Order::class)->findOneBy(['code' => '5501']), 'Nothing is placed.');
        self::assertSame('1', $this->em()->find(AppSetting::class, 'webhooks.legacy_hits')?->value(), 'The hit is counted.');
        self::assertNotNull($this->em()->find(AppSetting::class, 'webhooks.legacy_last_hit_at')?->value());
    }

    public function testWithTheSwitchOnTheLegacyUrlWorksAsBefore(): void
    {
        $warehouse = $this->aWarehouse('Usa', ['https://usa.test']);
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        $this->save(new AppSetting('webhooks.legacy_enabled', '1', false, new \DateTimeImmutable()));

        $this->postWebhook('https://usa.test', self::payload());

        $this->assertStatus(200);
        $this->em()->clear();
        self::assertNotNull($this->em()->getRepository(Order::class)->findOneBy(['code' => '5501']));
    }

    /**
     * @param array<string, mixed> $payload
     *
     * @return array<mixed>
     */
    private function postWebhook(string $source, array $payload): array
    {
        $this->client->request('POST', self::URL, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_X-WC-Webhook-Source' => $source], content: json_encode($payload, \JSON_THROW_ON_ERROR));

        return $this->body();
    }

    /**
     * @return array<string, mixed>
     */
    private static function payload(int $id = 5501): array
    {
        return [
            'id' => $id,
            'billing' => ['first_name' => 'Ana', 'last_name' => 'Gomez', 'email' => 'ana@example.com', 'phone' => '555-0100', 'address_1' => '1 Billing St', 'postcode' => '33101', 'city' => 'Miami', 'state' => 'FL', 'country' => 'US'],
            'shipping' => ['first_name' => 'Ana', 'last_name' => 'Gomez', 'address_1' => '2 Shipping Ave', 'postcode' => '10001', 'city' => 'New York', 'state' => 'NY', 'country' => 'US'],
            'line_items' => [['sku' => 'KF-01', 'quantity' => 2], ['sku' => 'KF-02', 'quantity' => 1]],
        ];
    }

    /**
     * @return list<mixed>
     */
    private static function address(CustomerAddress $address): array
    {
        return [$address->getAddressType(), $address->getAddress(), $address->getZipCode(), $address->getCity()?->getName(), $address->getCity()?->getState()?->getName(), $address->getCity()?->getState()?->getCountry()?->getName()];
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
