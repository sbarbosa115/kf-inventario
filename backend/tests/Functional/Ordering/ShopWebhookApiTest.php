<?php

namespace App\Tests\Functional\Ordering;

use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderCommentMeta;
use App\Ordering\Domain\Model\ShopDelivery;
use App\Ordering\Domain\Model\ShopOrderLink;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Symfony\Component\Mime\Email;

/**
 * A connection's own webhook, /webhooks/shops/{token} (docs/pdr/prd-shops-settings.md, "Shop connections" and
 * Security): the token names the connection, the signature is required, the order lands in the connection's
 * warehouse and is linked to it, the printer gets it when the connection prints; what cannot be placed waits in the
 * inbox. Unknown tokens store nothing.
 */
final class ShopWebhookApiTest extends ApiTestCase
{
    use OrderingFixtures;
    use ShopConnections;
    use SignsIn;

    public function testASignedDeliveryIsPlacedInTheConnectionsWarehouseAndLinkedToIt(): void
    {
        $this->aWarehouse('Colombia');
        $usa = $this->aWarehouse('Usa');
        $this->aProduct('KF-01', $usa);
        $this->aProduct('KF-02', $usa);
        $connection = $this->aConnection($usa, ['email_printer' => false]);

        $answer = $this->deliver(self::tokenOf($connection), self::shopOrder(5501, customerNote: 'Gift wrap, please'), (string) $connection['webhook_secret']);

        $this->assertStatus(200);
        self::assertSame(['status' => true], $answer);
        $this->em()->clear();
        $order = $this->em()->getRepository(Order::class)->findOneBy(['code' => '5501']);
        self::assertNotNull($order, 'The shop order id is the order code, as before.');
        self::assertSame($usa->getId(), $order->getWarehouse()?->getId(), 'The connection\'s warehouse: no matching of X-WC-Webhook-Source.');
        self::assertSame(Order::SOURCE_WEB, $order->getSource(), 'order.source stays Web: the shop is the link.');
        $link = $this->em()->getRepository(ShopOrderLink::class)->findOneBy(['order' => $order]);
        self::assertNotNull($link);
        self::assertSame($connection['id'], $link->connection()->id());
        self::assertSame('5501', $link->remoteOrderId());
        self::assertSame('processing', $link->remoteStatus());

        $this->signInAs(['ROLE_USER', 'ROLE_CAN_READ_ORDERS'], 'office');
        $detail = $this->getJson('/api/v1/orders/'.$order->getId());
        self::assertSame(['id' => $connection['id'], 'name' => 'Kfvintage', 'takes_notes' => false], $detail['shop'], 'The order names its shop.');
        $list = $this->getJson('/api/v1/orders?warehouse_id='.$usa->getId());
        self::assertSame(['id' => $connection['id'], 'name' => 'Kfvintage', 'takes_notes' => false], $list['items'][0]['shop']);

        $comments = $this->em()->getRepository(Comment::class)->findBy(['order' => $order->getId()]);
        self::assertCount(1, $comments, 'The customer\'s checkout note becomes a shop comment.');
        self::assertSame('Gift wrap, please', $comments[0]->getContent());
        self::assertNull($comments[0]->getUser(), 'A shop note has no author in the app.');
        $meta = $this->em()->find(OrderCommentMeta::class, $comments[0]->getId());
        self::assertSame(OrderCommentMeta::ORIGIN_SHOP, $meta?->origin());
        self::assertSame($connection['id'], $meta->connection()?->id());

        $health = $this->connection($connection['id']);
        self::assertNotNull($health->lastWebhookAt());
        self::assertNotNull($health->lastImportAt());
        self::assertNull($health->lastFailureAt());
        self::assertEmailCount(0, message: 'This connection does not print its orders.');
    }

    public function testTheConnectionsPrinterSwitchSaysWhetherTheOrderIsEmailed(): void
    {
        $warehouse = $this->aWarehouse('Usa');
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        $connection = $this->aConnection($warehouse, ['email_printer' => true]);

        $this->deliver(self::tokenOf($connection), self::shopOrder(5601), (string) $connection['webhook_secret']);

        $this->assertStatus(200);
        self::assertEmailCount(1, message: 'A printing connection emails the printer, whatever ORDER_WEBHOOK_EMAIL_WAREHOUSE_ID says.');
        $email = self::getMailerMessage();
        self::assertInstanceOf(Email::class, $email);
        self::assertSame('Order #5601 was created', $email->getSubject());
    }

    public function testAWrongOrMissingSignatureIsRefusedKeptInTheInboxWithoutItsBodyAndShownInHealth(): void
    {
        $warehouse = $this->aWarehouse();
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        $connection = $this->aConnection($warehouse);

        $answer = $this->deliver(self::tokenOf($connection), self::shopOrder(5701), 'not-the-secret');
        $this->assertStatus(401);
        self::assertSame(['status' => false], $answer);
        $this->deliver(self::tokenOf($connection), self::shopOrder(5702), null);
        $this->assertStatus(401, 'The signature is required: there is no "no secret, no check".');

        $this->em()->clear();
        self::assertSame(0, $this->em()->getRepository(Order::class)->count([]));
        $rows = $this->deliveries();
        self::assertCount(2, $rows);
        self::assertSame([ShopDelivery::REASON_BAD_SIGNATURE, ShopDelivery::STATUS_FAILED, null, ShopDelivery::KIND_WEBHOOK], [$rows[0]->reasonCode(), $rows[0]->status(), $rows[0]->payload(), $rows[0]->kind()], 'A refused signature keeps no body.');
        $health = $this->connection($connection['id']);
        self::assertSame('bad_signature', $health->lastFailureCode());
        self::assertNotNull($health->lastFailureAt());
        self::assertTrue($health->isFailing());
    }

    public function testAnUnknownTokenIsNotFoundAndStoresNothing(): void
    {
        $answer = $this->deliver(str_repeat('ab', 32), self::shopOrder(), 'whatever');

        $this->assertStatus(404);
        self::assertSame(['status' => false], $answer);
        self::assertSame([], $this->deliveries(), 'No amplification into the inbox.');
    }

    public function testAnInactiveConnectionKeepsTheDeliveryInTheInbox(): void
    {
        $warehouse = $this->aWarehouse();
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        $connection = $this->aConnection($warehouse, ['active' => false]);
        $body = json_encode(self::shopOrder(5801), \JSON_THROW_ON_ERROR);

        $answer = $this->deliver(self::tokenOf($connection), $body, (string) $connection['webhook_secret']);

        $this->assertStatus(200, 'Accepted: the shop must not retry and disable the webhook.');
        self::assertSame(['status' => true], $answer);
        $this->em()->clear();
        self::assertSame(0, $this->em()->getRepository(Order::class)->count([]), 'Nothing is placed while the connection is off.');
        $rows = $this->deliveries();
        self::assertCount(1, $rows);
        self::assertSame([ShopDelivery::REASON_INACTIVE, '5801', $body], [$rows[0]->reasonCode(), $rows[0]->remoteOrderId(), $rows[0]->payload()], 'Kept with its body: Retry places it once the connection is active.');
    }

    public function testTheSameOrderDeliveredTwiceIsPlacedOnce(): void
    {
        $warehouse = $this->aWarehouse();
        $this->aProduct('KF-01', $warehouse);
        $this->aProduct('KF-02', $warehouse);
        $connection = $this->aConnection($warehouse, ['email_printer' => true]);
        $this->client->disableReboot();

        $this->deliver(self::tokenOf($connection), self::shopOrder(5901), (string) $connection['webhook_secret']);
        self::assertEmailCount(1);
        $answer = $this->deliver(self::tokenOf($connection), self::shopOrder(5901), (string) $connection['webhook_secret']);

        $this->assertStatus(200);
        self::assertSame(['status' => true], $answer);
        self::assertEmailCount(0, message: 'Not printed again.');
        $this->em()->clear();
        self::assertSame(1, $this->em()->getRepository(Order::class)->count(['code' => '5901']));
        self::assertSame([], $this->deliveries(), 'A duplicate stores nothing (Decisions 6).');
    }

    public function testABodyOverOneMegabyteIsRefusedBeforeParsing(): void
    {
        $connection = $this->aConnection($this->aWarehouse());
        $body = json_encode(['id' => 1, 'padding' => str_repeat('x', 1024 * 1024)], \JSON_THROW_ON_ERROR);

        $this->deliver(self::tokenOf($connection), $body, (string) $connection['webhook_secret']);

        $this->assertStatus(413);
        self::assertSame([], $this->deliveries());
    }

    public function testWooCommercesPingIsAnsweredOkAndMovesLastWebhook(): void
    {
        $connection = $this->aConnection($this->aWarehouse());

        $this->client->request('GET', '/webhooks/shops/'.self::tokenOf($connection));
        $this->assertStatus(200);
        self::assertSame(['status' => true], $this->body());
        // Saving a webhook in WooCommerce posts `webhook_id=<id>` (a form, unsigned) to check the URL answers.
        $this->client->request('POST', '/webhooks/shops/'.self::tokenOf($connection), server: ['CONTENT_TYPE' => 'application/x-www-form-urlencoded'], content: 'webhook_id=17');
        $this->assertStatus(200);
        self::assertSame(['status' => true], $this->body());

        self::assertSame([], $this->deliveries());
        self::assertNotNull($this->connection($connection['id'])->lastWebhookAt(), 'The ping shows the shop reaches its connection.');
    }
}
