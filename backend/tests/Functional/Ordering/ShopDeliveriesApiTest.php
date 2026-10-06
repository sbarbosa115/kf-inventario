<?php

namespace App\Tests\Functional\Ordering;

use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\ShopOrderLink;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * The failed-deliveries inbox (docs/pdr/prd-shops-settings.md, Decisions 7): a shop order that cannot be placed is
 * kept with its body and reason; the admin fixes the cause (creates the SKU) and presses Retry, or discards it.
 */
final class ShopDeliveriesApiTest extends ApiTestCase
{
    use OrderingFixtures;
    use ShopConnections;
    use SignsIn;

    public function testAnOrderNamingAnUnknownSkuIsKeptWithItsBodyAndReason(): void
    {
        $warehouse = $this->aWarehouse();
        $this->aProduct('KF-01', $warehouse);
        $connection = $this->aConnection($warehouse);
        $body = json_encode(self::shopOrder(5501, [['KF-01', 2], ['KF-99', 1]]), \JSON_THROW_ON_ERROR);

        $answer = $this->deliver(self::tokenOf($connection), $body, (string) $connection['webhook_secret']);

        $this->assertStatus(200, 'Accepted and kept: the shop must not retry it.');
        self::assertSame(['status' => true], $answer);
        $this->em()->clear();
        self::assertSame(0, $this->em()->getRepository(Order::class)->count([]), 'Nothing half-placed.');

        $page = $this->getJson('/api/v1/shops/'.$connection['id'].'/deliveries?status=failed');
        $this->assertStatus(200);
        self::assertSame(1, $page['total']);
        $row = $page['items'][0];
        self::assertSame(['webhook', '5501', 'failed', 'unknown_product', 1, null], [$row['kind'], $row['remote_order_id'], $row['status'], $row['reason_code'], $row['attempts'], $row['order']]);
        self::assertStringContainsString('KF-99', (string) $row['reason']);
        self::assertSame(['customer' => 'Ana Gomez', 'lines' => [['sku' => 'KF-01', 'quantity' => 2], ['sku' => 'KF-99', 'quantity' => 1]]], $row['summary']);
        self::assertArrayNotHasKey('payload', $row, 'The body (customer data) only in the detail.');

        $detail = $this->getJson('/api/v1/shops/'.$connection['id'].'/deliveries/'.$row['id']);
        $this->assertStatus(200);
        self::assertSame($body, $detail['payload']);

        $shop = $this->getJson('/api/v1/shops/'.$connection['id']);
        self::assertSame(1, $shop['health']['failed_deliveries']);
        self::assertSame('unknown_product', $shop['health']['last_failure_code']);
    }

    public function testRetryAfterTheProductIsCreatedPlacesTheOrder(): void
    {
        $warehouse = $this->aWarehouse();
        $this->aProduct('KF-01', $warehouse);
        $connection = $this->aConnection($warehouse);
        $this->deliver(self::tokenOf($connection), self::shopOrder(5502, [['KF-01', 2], ['KF-99', 1]]), (string) $connection['webhook_secret']);
        $id = $this->getJson('/api/v1/shops/'.$connection['id'].'/deliveries?status=failed')['items'][0]['id'];

        $still = $this->sendJson('POST', '/api/v1/shops/'.$connection['id'].'/deliveries/'.$id.'/retry');
        $this->assertStatus(200);
        self::assertSame(['failed', 'unknown_product', 2], [$still['status'], $still['reason_code'], $still['attempts']], 'Not fixed yet: still failed, one more attempt.');

        $this->aProduct('KF-99', $warehouse);
        $placed = $this->sendJson('POST', '/api/v1/shops/'.$connection['id'].'/deliveries/'.$id.'/retry');

        $this->assertStatus(200);
        self::assertSame('placed', $placed['status']);
        self::assertNull($placed['reason_code']);
        self::assertSame('5502', $placed['order']['code']);
        $this->em()->clear();
        $order = $this->em()->find(Order::class, $placed['order']['id']);
        self::assertSame($warehouse->getId(), $order?->getWarehouse()?->getId());
        self::assertNotNull($this->em()->getRepository(ShopOrderLink::class)->findOneBy(['order' => $order]), 'Linked to the connection, like a webhook order.');
        self::assertSame(0, $this->getJson('/api/v1/shops/'.$connection['id'].'/deliveries?status=failed')['total'], 'It leaves the failed filter.');
        self::assertSame(1, $this->getJson('/api/v1/shops/'.$connection['id'].'/deliveries')['total'], 'Kept as placed.');
    }

    public function testADeliveryCanBeDiscarded(): void
    {
        $warehouse = $this->aWarehouse();
        $connection = $this->aConnection($warehouse);
        $this->deliver(self::tokenOf($connection), self::shopOrder(5503, [['KF-99', 1]]), (string) $connection['webhook_secret']);
        $id = $this->getJson('/api/v1/shops/'.$connection['id'].'/deliveries?status=failed')['items'][0]['id'];

        $discarded = $this->sendJson('POST', '/api/v1/shops/'.$connection['id'].'/deliveries/'.$id.'/discard');

        $this->assertStatus(200);
        self::assertSame('discarded', $discarded['status']);
        self::assertSame(0, $this->getJson('/api/v1/shops/'.$connection['id'])['health']['failed_deliveries']);
        $page = $this->getJson('/api/v1/shops/'.$connection['id'].'/deliveries?filter[status][]=discarded');
        self::assertSame([$id], array_column($page['items'], 'id'));
    }

    public function testAnotherConnectionsDeliveryIsNotFound(): void
    {
        $warehouse = $this->aWarehouse();
        $first = $this->aConnection($warehouse);
        $second = $this->aConnection($warehouse, ['name' => 'Second', 'site_url' => 'https://second.example.com']);
        $this->deliver(self::tokenOf($first), self::shopOrder(5504, [['KF-99', 1]]), (string) $first['webhook_secret']);
        $id = $this->getJson('/api/v1/shops/'.$first['id'].'/deliveries')['items'][0]['id'];

        foreach (['GET' => '', 'POST' => '/retry'] as $method => $suffix) {
            $this->sendJson($method, '/api/v1/shops/'.$second['id'].'/deliveries/'.$id.$suffix);

            $this->assertStatus(404);
            self::assertSame('delivery_not_found', $this->body()['error']);
        }
        self::assertSame(0, $this->getJson('/api/v1/shops/'.$second['id'].'/deliveries')['total']);
    }

    public function testTheInboxFiltersByTextOnTheShopOrderAndCustomer(): void
    {
        $warehouse = $this->aWarehouse();
        $connection = $this->aConnection($warehouse);
        $this->deliver(self::tokenOf($connection), self::shopOrder(6101, [['KF-99', 1]]), (string) $connection['webhook_secret']);
        $this->deliver(self::tokenOf($connection), self::shopOrder(6202, [['KF-98', 1]]), (string) $connection['webhook_secret']);

        self::assertSame(['6202'], array_column($this->getJson('/api/v1/shops/'.$connection['id'].'/deliveries?q=6202')['items'], 'remote_order_id'));
        self::assertSame(2, $this->getJson('/api/v1/shops/'.$connection['id'].'/deliveries?q=gomez')['total']);
        self::assertSame(['6202', '6101'], array_column($this->getJson('/api/v1/shops/'.$connection['id'].'/deliveries')['items'], 'remote_order_id'), 'Newest first.');
        $this->getJson('/api/v1/shops/'.$connection['id'].'/deliveries?filter[nope]=1');
        $this->assertStatus(422);
    }
}
