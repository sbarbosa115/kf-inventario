<?php

namespace App\Tests\Functional\Ordering;

use App\Customers\Domain\Model\Customer;
use App\Customers\Domain\Model\CustomerAddress;
use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderStatus;
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
        self::assertSame([CustomerAddress::ADDRESS_BILLING, '1 Billing St', '33101', 'Miami', 'FL', 'US'], self::address($addresses[0]));
        self::assertSame([CustomerAddress::ADDRESS_SHIPPING, '2 Shipping Ave', '10001', 'New York', 'NY', 'US'], self::address($addresses[1]));
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
