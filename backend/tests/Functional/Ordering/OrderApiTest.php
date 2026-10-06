<?php

namespace App\Tests\Functional\Ordering;

use App\Audit\Domain\Model\Log;
use App\Customers\Domain\Model\Customer;
use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderCommentMeta;
use App\Ordering\Domain\Model\OrderStatus;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopOrderLink;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * Orders typed by hand (ports the legacy OrderControllerTest / OrderServiceTest / CommentServiceTest): place, read,
 * list, edit, change the status, sync the comments, delete.
 */
final class OrderApiTest extends ApiTestCase
{
    use OrderingFixtures;
    use SignsIn;

    public function testPlacingAnOrderSavesItWithItsCustomerProductsCommentsAndFirstStatusRow(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        $customer = $this->aCustomer();
        $a = $this->aProduct('ADD-NEW-KF-01', $warehouse);
        $b = $this->aProduct('ADD-NEW-KF-02', $warehouse);

        $order = $this->sendJson('POST', '/api/v1/orders', $this->orderPayload($warehouse, $customer, [[$a, 10], [$b, 20]]));

        $this->assertStatus(201);
        self::assertSame('KF-ORDER-01', $order['code']);
        self::assertSame(Order::STATUS_CREATED, $order['status']);
        self::assertSame(Order::SOURCE_PHONE, $order['source']);
        self::assertSame(Order::PAYMENT_CREDIT_CARD, $order['payment_method']);
        self::assertSame('Leave it at the door', $order['comment']);
        self::assertSame(['id' => $warehouse->getId(), 'name' => 'Usa'], $order['warehouse']);
        self::assertSame($customer->getId(), $order['customer']['id'], 'The customer given by id is reused, not created again.');
        self::assertSame('Bogota', $order['customer']['addresses'][0]['city']['name']);
        self::assertSame([
            ['uuid' => $a->getUuid(), 'quantity' => 10, 'product' => ['code' => 'ADD-NEW-KF-01', 'title' => 'Title ADD-NEW-KF-01', 'detail' => 'Detail ADD-NEW-KF-01']],
            ['uuid' => $b->getUuid(), 'quantity' => 20, 'product' => ['code' => 'ADD-NEW-KF-02', 'title' => 'Title ADD-NEW-KF-02', 'detail' => 'Detail ADD-NEW-KF-02']],
        ], $order['products']);
        self::assertSame(['First comment', 'Second comment'], array_column($order['comments'], 'content'));
        self::assertMatchesRegularExpression('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/', $order['created_at']);

        $this->em()->clear();
        $statuses = $this->em()->getRepository(OrderStatus::class)->findBy(['order' => $order['id']]);
        self::assertCount(1, $statuses, 'A new order gets exactly one status row (OrderStatusHistoryListener).');
        self::assertSame(Order::STATUS_CREATED, $statuses[0]->getStatus());
        self::assertSame(1, $this->em()->getRepository(Customer::class)->count([]), 'No second customer.');
        $log = $this->em()->getRepository(Log::class)->findOneBy(['entity' => 'order', 'event' => 'Order created']);
        self::assertNotNull($log, 'Placing an order is written to the activity log, as before.');
    }

    public function testANewCustomerIsCreatedWithItsLocationsAndAKnownEmailIsReused(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        $known = $this->aCustomer('known@example.com');
        $a = $this->aProduct('KF-A', $warehouse);
        $payload = $this->orderPayload($warehouse, $known, [[$a, 1]]);

        $payload['customer'] = ['first_name' => 'Ana', 'last_name' => 'Gomez', 'email' => 'ana@example.com', 'phone' => '1', 'addresses' => [
            ['address' => 'Main St 1', 'zip_code' => '33101', 'address_type' => 2, 'city' => ['name' => 'Miami', 'state' => ['name' => 'Florida', 'country' => ['name' => 'United States']]]],
        ]];
        $created = $this->sendJson('POST', '/api/v1/orders', $payload);
        $this->assertStatus(201);
        $payload['customer'] = ['first_name' => 'Known', 'last_name' => 'Again', 'email' => 'known@example.com', 'phone' => '2', 'addresses' => []];
        $reused = $this->sendJson('POST', '/api/v1/orders', $payload);
        $this->assertStatus(201);

        self::assertNotSame($known->getId(), $created['customer']['id']);
        self::assertSame('Miami', $created['customer']['addresses'][0]['city']['name']);
        self::assertSame('Florida', $created['customer']['addresses'][0]['city']['state']['name']);
        self::assertSame('United States', $created['customer']['addresses'][0]['city']['state']['country']['name']);
        self::assertSame($known->getId(), $reused['customer']['id'], 'A customer is found by email when no id is given (CustomerService::addOrUpdate).');
        self::assertSame('Known', $reused['customer']['first_name'], 'and updated with what the order says.');
    }

    public function testAnOrderNeedsProductsThatExist(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        $customer = $this->aCustomer();

        $empty = $this->sendJson('POST', '/api/v1/orders', $this->orderPayload($warehouse, $customer, []));
        $this->assertStatus(422);
        self::assertSame('order_without_products', $empty['error']);

        $payload = $this->orderPayload($warehouse, $customer, []);
        $payload['products'] = [['uuid' => 'not-a-product', 'quantity' => 1]];
        $unknown = $this->sendJson('POST', '/api/v1/orders', $payload);
        $this->assertStatus(404);
        self::assertSame('product_not_found', $unknown['error']);

        $product = $this->aProduct('KF-A', $warehouse);
        $unknownWarehouse = $this->sendJson('POST', '/api/v1/orders', $this->orderPayload($warehouse, $customer, [[$product, 1]], ['warehouse_id' => 999999]));
        $this->assertStatus(404);
        self::assertSame('warehouse_not_found', $unknownWarehouse['error']);

        $this->em()->clear();
        self::assertSame(0, $this->em()->getRepository(Order::class)->count([]), 'A refused order leaves nothing behind.');
    }

    public function testAnOrderNamesItsShopAndItsPinnedCommentFromTheShopsSettingsTables(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$this->aProduct('KF-A', $warehouse), 1]], ['code' => 'SHOP-1', 'comments' => [['content' => 'Ring twice']]]);
        $plain = $this->placeOrder($warehouse, $this->aCustomer('other@kf.test'), [[$this->aProduct('KF-B', $warehouse), 1]], ['code' => 'PHONE-1']);

        $list = $this->getJson('/api/v1/orders?warehouse_id='.$warehouse->getId())['items'];
        self::assertSame([null, null], array_column($list, 'shop'), 'Orders without a link name no shop.');
        self::assertSame([null, null], array_column($list, 'pinned_comment'));
        $comment = $this->getJson('/api/v1/orders/'.$id)['comments'][0];
        self::assertSame('app', $comment['origin'], 'A comment without metadata is an app comment.');
        self::assertFalse($comment['pinned']);
        self::assertFalse($comment['approximate'], 'Comments written by the app have their date.');
        self::assertNotNull($comment['created_at']);
        self::assertSame('Test tester', $comment['author']['name'] ?? null, 'Signed by whoever wrote it.');
        self::assertFalse($comment['sent_to_shop']);

        $em = $this->em();
        $order = $em->find(Order::class, $id);
        self::assertNotNull($order);
        $managedWarehouse = $em->find(Warehouse::class, $warehouse->getId());
        self::assertNotNull($managedWarehouse);
        $connection = new ShopConnection('Kfvintage', 'https://kfvintage.test', 'v1:k', 'v1:s', str_repeat('ab', 32), 'v1:w', $managedWarehouse, true, true, [], new \DateTimeImmutable());
        $em->persist($connection);
        $em->persist(new ShopOrderLink($order, $connection, '5501', 'processing', new \DateTimeImmutable()));
        $pinned = $em->find(Comment::class, $comment['id']);
        self::assertNotNull($pinned);
        $meta = new OrderCommentMeta($pinned, OrderCommentMeta::ORIGIN_APP);
        $meta->pin(new \DateTimeImmutable(), null);
        $em->persist($meta);
        $em->flush();
        $em->clear();

        $list = $this->getJson('/api/v1/orders?warehouse_id='.$warehouse->getId())['items'];
        $byCode = array_column($list, null, 'code');
        self::assertSame(['id' => $connection->id(), 'name' => 'Kfvintage'], $byCode['SHOP-1']['shop']);
        self::assertSame('Ring twice', $byCode['SHOP-1']['pinned_comment']['content'] ?? null);
        self::assertNull($byCode['PHONE-1']['shop']);
        $detail = $this->getJson('/api/v1/orders/'.$id);
        self::assertSame('Kfvintage', $detail['shop']['name'] ?? null);
        self::assertTrue($detail['comments'][0]['pinned']);
        self::assertSame(['shop:'.$connection->id()], array_unique(array_map(static fn (array $o) => 'shop:'.($o['shop']['id'] ?? ''), $this->getJson('/api/v1/orders?warehouse_id='.$warehouse->getId().'&filter[source][]=shop:'.$connection->id())['items'])), 'The source filter knows the shop.');
        self::assertSame([$plain], array_column($this->getJson('/api/v1/orders?warehouse_id='.$warehouse->getId().'&filter[source][]=phone')['items'], 'id'));
    }

    public function testTheCommentPinnedFromTheTimelineIsTheListsNotesLine(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$this->aProduct('KF-A', $warehouse), 1]], ['code' => 'PINNED-1']);
        $this->placeOrder($warehouse, $this->aCustomer('other@kf.test'), [[$this->aProduct('KF-B', $warehouse), 1]], ['code' => 'PLAIN-1']);
        $second = $this->getJson('/api/v1/orders/'.$id)['comments'][1];

        $this->sendJson('POST', "/api/v1/orders/{$id}/comments/{$second['id']}/pin");
        $this->assertStatus(200);

        $byCode = array_column($this->getJson('/api/v1/orders?warehouse_id='.$warehouse->getId())['items'], null, 'code');
        self::assertSame(['id' => $second['id'], 'content' => 'Second comment', 'created_at' => $second['created_at']], $byCode['PINNED-1']['pinned_comment'], "The list carries the pinned comment's id, text and date.");
        self::assertNull($byCode['PLAIN-1']['pinned_comment']);
        self::assertSame(['PINNED-1'], array_column($this->getJson('/api/v1/orders?warehouse_id='.$warehouse->getId().'&filter[pinned][]=1')['items'], 'code'), 'The "Pinned only" filter finds it.');
    }

    public function testAnOrderIsReadAndListedByWarehouseNewestFirst(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $usa = $this->aWarehouse('Usa');
        $colombia = $this->aWarehouse('Colombia');
        $customer = $this->aCustomer();
        $a = $this->aProduct('KF-A', $usa);
        $first = $this->placeOrder($usa, $customer, [[$a, 1]], ['code' => 'FIRST']);
        $second = $this->placeOrder($usa, $customer, [[$a, 2]], ['code' => 'SECOND']);
        $this->placeOrder($colombia, $customer, [[$a, 3]], ['code' => 'ELSEWHERE']);

        $list = $this->getJson('/api/v1/orders?warehouse_id='.$usa->getId())['items'];
        $this->assertStatus(200);
        self::assertSame([$second, $first], array_column($list, 'id'), "One warehouse's orders, newest first.");
        self::assertSame(['id' => $customer->getId(), 'first_name' => 'Jose', 'last_name' => 'Perez', 'email' => 'jose.perez@example.com', 'phone' => '3001234567'], $list[0]['customer']);
        self::assertSame(2, $list[0]['comments_count']);
        self::assertSame(['id' => $usa->getId(), 'name' => 'Usa'], $list[0]['warehouse']);

        $detail = $this->getJson('/api/v1/orders/'.$first);
        $this->assertStatus(200);
        self::assertSame('FIRST', $detail['code']);
        self::assertSame(1, $detail['products'][0]['quantity']);

        $this->getJson('/api/v1/orders/999999');
        $this->assertStatus(404);
        self::assertSame('order_not_found', $this->body()['error']);
    }

    public function testAnOrderWithoutCustomerIsStillListed(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        $order = new Order();
        $order->setCode('NO-CUSTOMER');
        $order->setStatus(Order::STATUS_CREATED);
        $order->setSource(Order::SOURCE_PHONE);
        $order->setWarehouse($warehouse);
        $this->save($order);

        $list = $this->getJson('/api/v1/orders?warehouse_id='.$warehouse->getId())['items'];

        $this->assertStatus(200);
        self::assertSame(['NO-CUSTOMER'], array_column($list, 'code'), 'The list left-joins the customer (decision 9).');
        self::assertNull($list[0]['customer']);
    }

    public function testEditingAnOrderReplacesItsProducts(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        $customer = $this->aCustomer();
        [$a, $b, $c, $d] = [$this->aProduct('KF-A', $warehouse), $this->aProduct('KF-B', $warehouse), $this->aProduct('KF-C', $warehouse), $this->aProduct('KF-D', $warehouse)];
        $id = $this->placeOrder($warehouse, $customer, [[$a, 10], [$b, 20], [$c, 30]]);

        $edited = $this->sendJson('PUT', '/api/v1/orders/'.$id, $this->orderPayload($warehouse, $customer, [[$a, 11], [$b, 20], [$d, 40]], ['code' => 'EDITED', 'comments' => []]));

        $this->assertStatus(200);
        self::assertSame('EDITED', $edited['code']);
        self::assertSame([[$a->getUuid(), 11], [$b->getUuid(), 20], [$d->getUuid(), 40]], array_map(static fn (array $line) => [$line['uuid'], $line['quantity']], $edited['products']));
        $reread = $this->getJson('/api/v1/orders/'.$id);
        self::assertSame(['KF-A', 'KF-B', 'KF-D'], array_map(static fn (array $line) => $line['product']['code'], $reread['products']), 'KF-C is gone from the order.');
        self::assertCount(2, $reread['comments'], 'Editing keeps the comments (they are synced on their own).');
    }

    public function testChangingTheStatusAddsAStatusRow(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS', 'ROLE_UPDATE_ORDERS']);
        $warehouse = $this->aWarehouse();
        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$this->aProduct('KF-A', $warehouse), 1]]);

        $order = $this->sendJson('POST', "/api/v1/orders/{$id}/status", ['status' => Order::STATUS_PROCESSED]);

        $this->assertStatus(200);
        self::assertSame(Order::STATUS_PROCESSED, $order['status']);
        $this->em()->clear();
        $statuses = $this->em()->getRepository(OrderStatus::class)->findBy(['order' => $id], ['id' => 'ASC']);
        self::assertSame([Order::STATUS_CREATED, Order::STATUS_PROCESSED], array_map(static fn (OrderStatus $s) => $s->getStatus(), $statuses), 'Each status the order goes through is a row.');

        $this->sendJson('POST', "/api/v1/orders/{$id}/status", ['status' => 9]);
        $this->assertStatus(422);
    }

    public function testCommentsAreSyncedToWhatTheListSays(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$this->aProduct('KF-A', $warehouse), 1]]);
        $comments = $this->getJson('/api/v1/orders/'.$id)['comments'];

        $synced = $this->sendJson('PUT', "/api/v1/orders/{$id}/comments", ['comments' => [
            ['id' => $comments[0]['id'], 'content' => 'First comment Edited'],
            ['id' => $comments[1]['id'], 'content' => 'Second comment Edited'],
            ['id' => null, 'content' => 'New comment Added'],
        ]]);
        $this->assertStatus(200);
        self::assertSame(['First comment Edited', 'Second comment Edited', 'New comment Added'], array_column($synced['comments'], 'content'));

        $synced = $this->sendJson('PUT', "/api/v1/orders/{$id}/comments", ['comments' => [['id' => null, 'content' => 'This is the last comment Latest']]]);
        $this->assertStatus(200);
        self::assertSame(['This is the last comment Latest'], array_column($synced['comments'], 'content'), 'A comment missing from the list leaves the order.');
        self::assertCount(1, $this->getJson('/api/v1/orders/'.$id)['comments']);
    }

    public function testCommentsCanBeSyncedByAnySignedInUser(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS'], 'manager');
        $warehouse = $this->aWarehouse();
        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$this->aProduct('KF-A', $warehouse), 1]]);
        $this->signInAs(['ROLE_USER'], 'clerk');

        $this->sendJson('PUT', "/api/v1/orders/{$id}/comments", ['comments' => [['id' => null, 'content' => 'From the clerk']]]);

        $this->assertStatus(200, 'As before: sync-comments only asks for ROLE_USER (decision 11).');
        $this->em()->clear();
        $comment = $this->em()->getRepository(Comment::class)->findOneBy(['content' => 'From the clerk']);
        self::assertSame('clerk', $comment?->getUser()?->getUsername(), 'A new comment is signed by who wrote it.');
    }

    public function testDeletingAnOrderRemovesItsProductsAndCommentsAndHidesIt(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $warehouse = $this->aWarehouse();
        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$this->aProduct('KF-A', $warehouse), 1]]);

        $this->client->request('DELETE', '/api/v1/orders/'.$id);

        $this->assertStatus(204);
        $this->getJson('/api/v1/orders/'.$id);
        $this->assertStatus(404, 'A deleted order is not found.');
        $this->em()->clear();
        $this->em()->getFilters()->disable('softdeleteable');
        $order = $this->em()->find(Order::class, $id);
        self::assertNotNull($order?->getDeletedAt(), 'The order row stays, soft-deleted (Gedmo), as before.');
        self::assertCount(0, $order->getOrderProducts(), 'Its products are removed.');
        self::assertSame(1, $this->em()->getRepository(Log::class)->count(['entity' => 'order', 'event' => "Order {$id} was deleted"]), 'The delete is logged, as before.');

        $this->client->request('DELETE', '/api/v1/orders/'.$id);
        $this->assertStatus(404);
    }

    public function testEachEndpointAsksForTheRoleOfItsLegacyPage(): void
    {
        $this->signInAs(['ROLE_UPDATE_ORDERS'], 'updater');
        $warehouse = $this->aWarehouse();
        $id = $this->placeOrder($warehouse, $this->aCustomer(), [[$this->aProduct('KF-A', $warehouse), 1]]);

        $this->client->request('DELETE', '/api/v1/orders/'.$id);

        $this->assertStatus(403, 'ROLE_UPDATE_ORDERS creates and edits orders but does not delete them.');
    }
}
