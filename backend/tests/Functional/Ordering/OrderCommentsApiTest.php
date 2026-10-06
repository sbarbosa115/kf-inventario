<?php

namespace App\Tests\Functional\Ordering;

use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderCommentMeta;
use App\Ordering\Domain\Model\ShopCapability;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopOrderLink;
use App\Ordering\Domain\Model\ShopOutbox;
use App\Settings\Domain\Model\QuickPhrase;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * The order comment timeline (docs/pdr/prd-shops-settings.md, "API changes" › Comments; Decisions 14): read oldest
 * first with dates, authors, origins and pins; add a comment (typed, a quick phrase, also sent to the shop); pin one
 * per order.
 */
final class OrderCommentsApiTest extends ApiTestCase
{
    use OrderingFixtures;
    use SignsIn;

    public function testTheTimelineIsOldestFirstAndADatelessCommentCarriesTheOrdersDateMarkedApproximate(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $id = $this->anOrder();
        [$first, $second] = $this->commentIds($id);
        $db = $this->em()->getConnection();
        $db->executeStatement('UPDATE `order` SET created_at = ? WHERE id = ?', ['2026-01-01 10:00:00', $id]);
        $db->executeStatement('UPDATE comment SET created_at = ? WHERE id = ?', ['2026-01-05 09:30:00', $first]);
        $db->executeStatement('UPDATE comment SET created_at = NULL WHERE id = ?', [$second]);

        $comments = $this->getJson("/api/v1/orders/{$id}/comments")['comments'];

        $this->assertStatus(200);
        self::assertSame([$second, $first], array_column($comments, 'id'), 'Oldest first: the dateless comment takes the order date, which is older.');
        self::assertSame('2026-01-01T10:00:00-05:00', $comments[0]['created_at'], "A comment without a date carries the order's, in Bogota time.");
        self::assertTrue($comments[0]['approximate'], 'and says so.');
        self::assertSame('2026-01-05T09:30:00-05:00', $comments[1]['created_at']);
        self::assertFalse($comments[1]['approximate']);
        self::assertSame('Test tester', $comments[1]['author']['name'] ?? null, 'Each comment names who wrote it.');
        self::assertSame('app', $comments[1]['origin']);
        self::assertSame([$second, $first], array_column($this->getJson("/api/v1/orders/{$id}")['comments'], 'id'), 'The detail lists them in the same order.');
    }

    public function testCommentsOnTheSameMinuteKeepTheOrderTheyWereWrittenIn(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $id = $this->anOrder();
        [$first, $second] = $this->commentIds($id);
        $this->em()->getConnection()->executeStatement('UPDATE comment SET created_at = ? WHERE id IN (?, ?)', ['2026-02-01 08:00:00', $first, $second]);

        self::assertSame([$first, $second], array_column($this->getJson("/api/v1/orders/{$id}/comments")['comments'], 'id'));
    }

    public function testAShopNoteNamesItsShopAndNoAuthor(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $id = $this->anOrder();
        $connection = $this->aConnection('Kfvintage');
        $em = $this->em();
        $order = $em->find(Order::class, $id);
        self::assertNotNull($order);
        $note = new Comment();
        $note->setContent('Please gift wrap');
        $order->addComment($note);
        $em->persist($note);
        $em->persist(new OrderCommentMeta($note, OrderCommentMeta::ORIGIN_SHOP, $connection, '77'));
        $em->flush();
        $em->clear();

        $comments = $this->getJson("/api/v1/orders/{$id}/comments")['comments'];

        $shopNote = $comments[2];
        self::assertSame('Please gift wrap', $shopNote['content']);
        self::assertSame('shop', $shopNote['origin']);
        self::assertSame(['id' => $connection->id(), 'name' => 'Kfvintage', 'takes_notes' => false], $shopNote['shop']);
        self::assertNull($shopNote['author'], 'A shop note has no author in the app.');
        self::assertFalse($shopNote['pinned']);
        self::assertFalse($shopNote['sent_to_shop']);
        self::assertNull($comments[0]['shop'], 'An app comment names no shop.');
    }

    public function testAddingACommentAnswers201WithTheCommentDatedNowAndSignedByYou(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS'], 'manager');
        $id = $this->anOrder();
        $this->signInAs(['ROLE_USER'], 'clerk');

        $comment = $this->sendJson('POST', "/api/v1/orders/{$id}/comments", ['content' => "Call before\ndelivery"]);

        $this->assertStatus(201, 'Any signed-in user adds comments, as with the PUT.');
        self::assertSame("Call before\ndelivery", $comment['content'], 'The text is kept as typed, line breaks included.');
        self::assertSame('Test clerk', $comment['author']['name'] ?? null);
        self::assertSame('app', $comment['origin']);
        self::assertFalse($comment['approximate']);
        self::assertFalse($comment['sent_to_shop']);
        self::assertFalse($comment['pinned']);
        $at = new \DateTimeImmutable((string) $comment['created_at']);
        self::assertLessThan(60, abs(time() - $at->getTimestamp()), 'Dated now.');
        self::assertStringEndsWith('-05:00', (string) $comment['created_at'], 'In Bogota time.');

        $this->signInAs(['ROLE_MANAGE_ORDERS'], 'reader');
        $timeline = $this->getJson("/api/v1/orders/{$id}/comments")['comments'];
        self::assertSame($comment['id'], $timeline[2]['id'] ?? null, 'The new comment is the last of the timeline.');
        $this->em()->clear();
        $meta = $this->em()->find(OrderCommentMeta::class, $comment['id']);
        self::assertSame(OrderCommentMeta::ORIGIN_APP, $meta?->origin(), 'Its metadata row is written.');
    }

    public function testACommentNeedsText(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $id = $this->anOrder();

        $body = $this->sendJson('POST', "/api/v1/orders/{$id}/comments", ['content' => '   ']);

        $this->assertStatus(422);
        self::assertSame('content', $body['violations'][0]['field'] ?? null);
        $this->sendJson('POST', '/api/v1/orders/999999/comments', ['content' => 'Hello']);
        $this->assertStatus(404);
        self::assertSame('order_not_found', $this->body()['error']);
    }

    public function testAQuickPhraseIsAddedAsAPhraseComment(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $id = $this->anOrder();
        $phrase = new QuickPhrase('Customer called', 1, new \DateTimeImmutable());
        $hidden = new QuickPhrase('Old phrase', 2, new \DateTimeImmutable(), false);
        $this->save($phrase, $hidden);

        $comment = $this->sendJson('POST', "/api/v1/orders/{$id}/comments", ['content' => 'Customer called', 'phrase_id' => $phrase->id()]);

        $this->assertStatus(201);
        self::assertSame('phrase', $comment['origin'], 'A one-tap phrase is marked as one.');
        self::assertNotNull($comment['created_at'], 'and dated.');

        $this->sendJson('POST', "/api/v1/orders/{$id}/comments", ['content' => 'Old phrase', 'phrase_id' => $hidden->id()]);
        $this->assertStatus(404, 'An inactive phrase is not offered, so it cannot be posted.');
        self::assertSame('quick_phrase_not_found', $this->body()['error']);
        $this->sendJson('POST', "/api/v1/orders/{$id}/comments", ['content' => 'Ghost', 'phrase_id' => 999999]);
        $this->assertStatus(404);
        self::assertCount(3, $this->getJson("/api/v1/orders/{$id}/comments")['comments'], 'A refused comment is not written.');
    }

    public function testSendingToTheShopIsRefusedWhenTheOrderIsNotLinkedOrItsShopTakesNoNotes(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $plain = $this->anOrder('PHONE-1');
        $noNotes = $this->anOrder('SHOP-1', 'other@kf.test');
        $this->link($noNotes, $this->aConnection('Kfvintage', [ShopCapability::OrderStatus->value => true, ShopCapability::OrderNote->value => false]));
        $inactive = $this->anOrder('SHOP-2', 'third@kf.test');
        $this->link($inactive, $this->aConnection('Closed shop', [ShopCapability::OrderNote->value => true], active: false));

        foreach (['not linked' => $plain, 'order_note off' => $noNotes, 'connection inactive' => $inactive] as $why => $id) {
            $body = $this->sendJson('POST', "/api/v1/orders/{$id}/comments", ['content' => 'Shipped today', 'send_to_shop' => true]);

            $this->assertStatus(422, $why);
            self::assertSame('shop_note_unavailable', $body['error'] ?? null, $why);
            self::assertCount(2, $this->getJson("/api/v1/orders/{$id}/comments")['comments'], "{$why}: nothing is written.");
        }
        $this->em()->clear();
        self::assertSame(0, $this->em()->getRepository(ShopOutbox::class)->count([]), 'Nothing is queued for a shop.');
    }

    public function testSendingToTheShopQueuesAnOrderNoteForTheOrdersConnection(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $id = $this->anOrder();
        $connection = $this->aConnection('Kfvintage', [ShopCapability::OrderNote->value => true]);
        $this->link($id, $connection);

        $comment = $this->sendJson('POST', "/api/v1/orders/{$id}/comments", ['content' => 'Shipped today', 'send_to_shop' => true]);

        $this->assertStatus(201);
        self::assertTrue($comment['sent_to_shop'], 'The timeline marks it as sent to the shop.');
        self::assertNull($comment['shop'], 'It is the app\'s comment, not a shop note.');
        $this->em()->clear();
        $rows = $this->em()->getRepository(ShopOutbox::class)->findAll();
        self::assertCount(1, $rows, 'One outbox row: item 5b pushes it to the shop.');
        self::assertSame(ShopCapability::OrderNote, $rows[0]->capability());
        self::assertSame($connection->id(), $rows[0]->connection()->id());
        self::assertSame($id, $rows[0]->order()->getId());
        self::assertEquals(['comment_id' => $comment['id'], 'note' => 'Shipped today'], $rows[0]->payload(), 'The note and the comment it came from (MySQL keeps JSON keys in its own order).');
        self::assertNotNull($rows[0]->nextAttemptAt(), 'Due at once.');
    }

    public function testOneCommentIsPinnedPerOrderAndPinningAnotherUnpinsThePrevious(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS'], 'manager');
        $id = $this->anOrder();
        [$first, $second] = $this->commentIds($id);
        $this->signInAs(['ROLE_USER'], 'clerk');

        $pinned = $this->sendJson('POST', "/api/v1/orders/{$id}/comments/{$first}/pin");

        $this->assertStatus(200, 'Any signed-in user pins.');
        self::assertTrue($pinned['pinned']);
        self::assertSame('Test clerk', $pinned['pinned_by']['name'] ?? null);
        self::assertNotNull($pinned['pinned_at']);

        $this->sendJson('POST', "/api/v1/orders/{$id}/comments/{$second}/pin");
        $this->assertStatus(200);
        $this->signInAs(['ROLE_MANAGE_ORDERS'], 'reader');
        $byId = array_column($this->getJson("/api/v1/orders/{$id}/comments")['comments'], null, 'id');
        self::assertFalse($byId[$first]['pinned'], 'Pinning another comment unpins the previous one.');
        self::assertNull($byId[$first]['pinned_at']);
        self::assertTrue($byId[$second]['pinned']);
        self::assertSame($second, $this->getJson("/api/v1/orders/{$id}")['pinned_comment']['id'] ?? null);

        $unpinned = $this->sendJson('DELETE', "/api/v1/orders/{$id}/comments/{$second}/pin");
        $this->assertStatus(200);
        self::assertFalse($unpinned['pinned']);
        self::assertNull($unpinned['pinned_by']);
        self::assertNull($this->getJson("/api/v1/orders/{$id}")['pinned_comment'], 'No pinned comment left.');
        $this->sendJson('DELETE', "/api/v1/orders/{$id}/comments/{$first}/pin");
        $this->assertStatus(200, 'Unpinning a comment that is not pinned changes nothing.');
    }

    public function testOnlyTheOrdersOwnCommentsArePinned(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $id = $this->anOrder('A-1');
        $other = $this->anOrder('B-1', 'other@kf.test');
        [$foreign] = $this->commentIds($other);

        $this->sendJson('POST', "/api/v1/orders/{$id}/comments/{$foreign}/pin");
        $this->assertStatus(404, "Another order's comment is not found through this order.");
        self::assertSame('comment_not_found', $this->body()['error']);
        $this->sendJson('DELETE', "/api/v1/orders/{$id}/comments/999999/pin");
        $this->assertStatus(404);
        $this->sendJson('POST', "/api/v1/orders/999999/comments/{$foreign}/pin");
        $this->assertStatus(404);
        self::assertNull($this->getJson("/api/v1/orders/{$other}")['pinned_comment']);
    }

    public function testReadingTheTimelineNeedsTheOrdersReadRole(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS'], 'manager');
        $id = $this->anOrder();
        $this->signInAs(['ROLE_USER'], 'clerk');

        $this->getJson("/api/v1/orders/{$id}/comments");
        $this->assertStatus(403, 'GET asks for ROLE_CAN_READ_ORDERS, as the order detail does.');

        $this->signInAs(['ROLE_CAN_READ_ORDERS', 'ROLE_USER'], 'reader');
        $this->getJson("/api/v1/orders/{$id}/comments");
        $this->assertStatus(200);
        $this->getJson('/api/v1/orders/999999/comments');
        $this->assertStatus(404);
    }

    public function testThePutPathWritesAppMetadataForNewCommentsAndDropsThePinOfARemovedOne(): void
    {
        $this->signInAs(['ROLE_MANAGE_ORDERS']);
        $id = $this->anOrder();
        [$first, $second] = $this->commentIds($id);
        $this->sendJson('POST', "/api/v1/orders/{$id}/comments/{$first}/pin");
        $this->assertStatus(200);

        $synced = $this->sendJson('PUT', "/api/v1/orders/{$id}/comments", ['comments' => [
            ['id' => $second, 'content' => 'Second, edited'],
            ['id' => null, 'content' => 'Added in the form'],
        ]]);

        $this->assertStatus(200);
        self::assertSame([$second], \array_slice(array_column($synced['comments'], 'id'), 0, 1));
        $added = $synced['comments'][1];
        self::assertSame('Added in the form', $added['content']);
        $this->em()->clear();
        self::assertSame(OrderCommentMeta::ORIGIN_APP, $this->em()->find(OrderCommentMeta::class, $added['id'])?->origin(), 'A comment added through the form gets its metadata row.');
        self::assertFalse($this->em()->find(OrderCommentMeta::class, $first)?->isPinned(), 'A comment taken off the order is not pinned any more.');
        self::assertNull($this->getJson("/api/v1/orders/{$id}")['pinned_comment']);
    }

    private function anOrder(string $code = 'KF-ORDER-01', string $email = 'jose.perez@example.com'): int
    {
        $warehouse = $this->em()->getRepository(Warehouse::class)->findOneBy(['name' => 'Usa']) ?? $this->aWarehouse();
        $product = $this->aProduct('P-'.$code, $warehouse);

        return $this->placeOrder($warehouse, $this->aCustomer($email), [[$product, 1]], ['code' => $code]);
    }

    /**
     * @return list<int> the order's comments, in the order they were written
     */
    private function commentIds(int $orderId): array
    {
        $ids = array_map('intval', $this->em()->getConnection()->fetchFirstColumn('SELECT id FROM comment WHERE order_id = ? ORDER BY id', [$orderId]));
        self::assertCount(2, $ids, 'The order form wrote two comments.');

        return $ids;
    }

    /**
     * @param array<string, bool> $capabilities
     */
    private function aConnection(string $name, array $capabilities = [], bool $active = true): ShopConnection
    {
        $em = $this->em();
        $warehouse = $em->getRepository(Warehouse::class)->findOneBy(['name' => 'Usa']) ?? $this->aWarehouse();
        $connection = new ShopConnection($name, 'https://'.strtolower(str_replace(' ', '-', $name)).'.test', 'v1:k', 'v1:s', bin2hex(random_bytes(32)), 'v1:w', $warehouse, false, $active, $capabilities, new \DateTimeImmutable());
        $em->persist($connection);
        $em->flush();

        return $connection;
    }

    private function link(int $orderId, ShopConnection $connection): void
    {
        $em = $this->em();
        $order = $em->find(Order::class, $orderId);
        self::assertNotNull($order);
        $em->persist(new ShopOrderLink($order, $em->find(ShopConnection::class, $connection->id()) ?? $connection, 'R-'.$orderId, 'processing', new \DateTimeImmutable()));
        $em->flush();
        $em->clear();
    }
}
