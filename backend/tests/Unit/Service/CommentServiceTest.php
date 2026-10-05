<?php

namespace App\Tests\Unit\Service;

use App\Entity\Order;
use App\Entity\User;
use App\Services\CommentService;
use App\Tests\WebTestCase;

class CommentServiceTest extends WebTestCase
{
    public $client;

    public function setUp(): void
    {
        $this->client = static::createClient();
    }

    public function testSyncComments(): void
    {
        $orderAsArray = $this->createOrderAndGetItAsArray();
        /** @var $user User */
        $user = $this->getUserByEmail('sbarbosa115@gmail.com');

        $comments = $orderAsArray['comments'];
        foreach ($comments as $commentKey => $comment) {
            $comments[$commentKey]['content'] = "{$comment['content']} Edited";
        }

        $comments[] = [
            'id' => null,
            'content' => 'New comment Added',
        ];

        /** @var $order Order */
        $order = $this->getOrderByCode($orderAsArray['code']);

        /** @var $commentService CommentService */
        $commentService = $this->client->getContainer()->get(CommentService::class);
        $commentService->syncComments($comments, $user, $order);

        $this->assertSame(3, $order->getComments()->count());
        foreach ($order->getComments() as $comment) {
            $commentEdited = mb_strpos($comment->getContent(), 'Edited');
            $commentAdded = mb_strpos($comment->getContent(), 'Added');
            $this->assertNotFalse($commentEdited || $commentAdded);
        }

        $comments = [
            [
                'id' => null,
                'content' => 'This is the last comment Latest',
            ],
        ];

        $commentService->syncComments($comments, $user, $order);
        $this->assertSame(1, $order->getComments()->count());

        foreach ($order->getComments() as $comment) {
            $latestComment = mb_strpos($comment->getContent(), 'Latest');
            $this->assertNotFalse($latestComment);
        }
    }
}
