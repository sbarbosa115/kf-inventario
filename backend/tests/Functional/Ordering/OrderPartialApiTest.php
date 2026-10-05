<?php

namespace App\Tests\Functional\Ordering;

use App\Ordering\Domain\Model\Order;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * Partial shipments (ports the legacy OrderControllerTest::testPartialOrder and OrderService::createPartial): each one
 * takes its products out of the warehouse; shipping the whole order at once marks it sent; shipping more than was
 * ordered is refused.
 */
final class OrderPartialApiTest extends ApiTestCase
{
    use OrderingFixtures;
    use SignsIn;

    public function testPartialsAddUpUntilTheOrderIsShippedAndAThirdOneIsRefused(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        [$a, $b, $c] = [$this->aProduct('KF-A', $warehouse), $this->aProduct('KF-B', $warehouse), $this->aProduct('KF-C', $warehouse)];
        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$a, 10], [$b, 20], [$c, 30]], ['code' => 'PARTIAL_TESTING']);
        $partial = ['items' => [['uuid' => $a->getUuid(), 'quantity' => 5], ['uuid' => $b->getUuid(), 'quantity' => 10]]];

        $first = $this->sendJson('POST', "/api/v1/orders/{$id}/partials", $partial);

        $this->assertStatus(200);
        self::assertSame($id, $first['order_id']);
        self::assertSame(Order::STATUS_PARTIAL, $first['status']);
        self::assertSame([
            ['uuid' => $a->getUuid(), 'quantity' => 5, 'product' => ['code' => 'KF-A']],
            ['uuid' => $b->getUuid(), 'quantity' => 10, 'product' => ['code' => 'KF-B']],
        ], $first['products_aggregate']);
        self::assertSame([
            ['uuid' => $a->getUuid(), 'quantity' => 5],
            ['uuid' => $b->getUuid(), 'quantity' => 10],
            ['uuid' => $c->getUuid(), 'quantity' => 30],
        ], $first['pending'], 'Pending is what was ordered minus what the partials shipped.');
        self::assertSame(95, $this->stockOf($a, $warehouse), 'A partial takes its products out of the warehouse.');
        self::assertSame(90, $this->stockOf($b, $warehouse));
        self::assertSame(100, $this->stockOf($c, $warehouse));

        $second = $this->sendJson('POST', "/api/v1/orders/{$id}/partials", $partial);
        $this->assertStatus(200);
        self::assertSame([10, 20], array_column($second['products_aggregate'], 'quantity'));
        self::assertSame([0, 0, 30], array_column($second['pending'], 'quantity'));

        $third = $this->sendJson('POST', "/api/v1/orders/{$id}/partials", $partial);
        $this->assertStatus(409, 'KF-A and KF-B are already complete: today a 500 after saving, now refused (decision 9).');
        self::assertSame('partial_exceeds_order', $third['error']);
        self::assertSame(90, $this->stockOf($a, $warehouse), 'A refused partial takes nothing out of the warehouse.');

        $state = $this->getJson("/api/v1/orders/{$id}/partials");
        $this->assertStatus(200);
        self::assertSame([10, 20], array_column($state['products_aggregate'], 'quantity'), 'The refused partial was not saved.');
    }

    public function testShippingTheWholeOrderAtOnceMarksItSent(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        [$a, $b] = [$this->aProduct('KF-A', $warehouse, 10), $this->aProduct('KF-B', $warehouse, 25)];
        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$a, 10], [$b, 20]]);

        $sent = $this->sendJson('POST', "/api/v1/orders/{$id}/partials", ['items' => [['uuid' => $a->getUuid(), 'quantity' => 10], ['uuid' => $b->getUuid(), 'quantity' => 20]]]);

        $this->assertStatus(200);
        self::assertSame(Order::STATUS_SENT, $sent['status'], 'Everything ordered, in stock, in one go: the order is sent.');
        self::assertSame([10, 20], array_column($sent['products_aggregate'], 'quantity'));
        self::assertSame([0, 0], array_column($sent['pending'], 'quantity'));
        self::assertSame(0, $this->stockOf($a, $warehouse));
        self::assertSame(5, $this->stockOf($b, $warehouse));

        $again = $this->sendJson('POST', "/api/v1/orders/{$id}/partials", ['items' => [['uuid' => $a->getUuid(), 'quantity' => 1]]]);
        $this->assertStatus(409, 'A sent order takes no more partials.');
        self::assertSame('partial_exceeds_order', $again['error']);
    }

    public function testAPartialNeedsTheStockInTheWarehouse(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        $a = $this->aProduct('KF-A', $warehouse, 3);
        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$a, 10]]);

        $refused = $this->sendJson('POST', "/api/v1/orders/{$id}/partials", ['items' => [['uuid' => $a->getUuid(), 'quantity' => 5]]]);

        $this->assertStatus(422);
        self::assertSame('insufficient_stock', $refused['error']);
        self::assertSame(['code' => 'KF-A', 'available' => 3], $refused['detail']);
        self::assertSame(3, $this->stockOf($a, $warehouse));
    }

    public function testTheGettingReadyStateListsTheWarehouseStockOfTheOrdersProducts(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS'], 'manager');
        $warehouse = $this->aWarehouse();
        $other = $this->aWarehouse('Colombia');
        $a = $this->aProduct('KF-A', $warehouse, 7);
        $this->aProduct('KF-NOT-ORDERED', $warehouse, 7);
        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$a, 2]]);
        $this->aProduct('KF-ELSEWHERE', $other);
        $this->signInAs(['ROLE_USER'], 'packer');

        $state = $this->getJson("/api/v1/orders/{$id}/partials");

        $this->assertStatus(200, 'As before: the getting-ready screen only asks for ROLE_USER (decision 11).');
        self::assertSame(Order::STATUS_CREATED, $state['status']);
        self::assertSame([], $state['products_aggregate']);
        self::assertSame([['uuid' => $a->getUuid(), 'quantity' => 2]], $state['pending']);
        self::assertCount(1, $state['inventory'], "Only the order's products, in the order's warehouse.");
        self::assertSame('KF-A', $state['inventory'][0]['code']);
        self::assertSame(7, $state['inventory'][0]['quantity']);
        self::assertSame(['id' => $warehouse->getId(), 'name' => 'Usa'], $state['inventory'][0]['warehouse']);

        $this->sendJson('POST', '/api/v1/orders/999999/partials', ['items' => [['uuid' => $a->getUuid(), 'quantity' => 1]]]);
        $this->assertStatus(404);
        $this->sendJson('POST', "/api/v1/orders/{$id}/partials", ['items' => []]);
        $this->assertStatus(422);
    }

    public function testASignedInUserWithNoOrderRoleLoadsEverythingTheGettingReadyScreenShows(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS'], 'manager');
        $warehouse = $this->aWarehouse();
        [$a, $b] = [$this->aProduct('KF-A', $warehouse), $this->aProduct('KF-B', $warehouse)];
        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$a, 3], [$b, 4]], ['code' => 'READY-1']);
        $this->signInAs(['ROLE_USER'], 'packer');

        $state = $this->getJson("/api/v1/orders/{$id}/partials");

        $this->assertStatus(200, 'The legacy getting-ready page asked only for ROLE_USER (decision 11).');
        self::assertSame('READY-1', $state['code'], 'The screen titles itself with the order code.');
        self::assertCount(2, $state['products'], "The screen lists the order's lines from this endpoint alone.");
        self::assertSame(3, $state['products'][0]['quantity']);
        self::assertSame(['code' => 'KF-A', 'title' => 'Title KF-A', 'detail' => 'Detail KF-A'], $state['products'][0]['product']);
        self::assertSame(array_column($state['pending'], 'uuid'), array_column($state['products'], 'uuid'), 'A line and its pending row share the line uuid.');

        $this->getJson("/api/v1/orders/{$id}");
        $this->assertStatus(403, 'The order detail stays ROLE_CAN_READ_ORDERS: the screen must not need it.');
    }
}
