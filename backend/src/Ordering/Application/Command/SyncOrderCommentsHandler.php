<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Application\Port\CommentAuthors;
use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Repository\OrderRepository;
use App\Shared\Application\Command\CommandHandler;

/**
 * Legacy CommentService::syncComments. A comment left out of the list is detached from the order (order_id null),
 * not deleted, as before. An id that is not one of this order's comments is ignored (the legacy code edited any
 * comment by id, then failed on an unknown one).
 */
final class SyncOrderCommentsHandler implements CommandHandler
{
    public function __construct(
        private readonly OrderRepository $orders,
        private readonly CommentAuthors $authors,
    ) {
    }

    /**
     * @throws OrderNotFound
     */
    public function __invoke(SyncOrderComments $command): void
    {
        $order = $this->orders->get($command->orderId);
        $existing = [];
        foreach ($order->getComments() as $comment) {
            $existing[(int) $comment->getId()] = $comment;
        }

        $kept = [];
        foreach ($command->comments as $line) {
            if (null === $line->id) {
                $comment = new Comment();
                $comment->setUser($this->authors->get($command->authorId));
                $comment->setContent($line->content);
                $order->addComment($comment);
                $this->orders->addComment($comment);
                continue;
            }
            if (isset($existing[$line->id])) {
                $existing[$line->id]->setContent($line->content);
                $kept[$line->id] = true;
            }
        }

        foreach ($existing as $id => $comment) {
            if (!isset($kept[$id])) {
                $order->removeComment($comment);
            }
        }
    }
}
