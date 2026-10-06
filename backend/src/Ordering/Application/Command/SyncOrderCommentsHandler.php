<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Application\Port\CommentAuthors;
use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\OrderCommentMeta;
use App\Ordering\Domain\Repository\CommentMetaRepository;
use App\Ordering\Domain\Repository\OrderRepository;
use App\Shared\Application\Command\CommandHandler;

/**
 * Legacy CommentService::syncComments. A comment left out of the list is detached from the order (order_id null),
 * not deleted, as before, and loses its pin. An id that is not one of this order's comments is ignored (the legacy
 * code edited any comment by id, then failed on an unknown one). A new comment gets its metadata row (origin `app`),
 * as one added from the timeline does.
 */
final class SyncOrderCommentsHandler implements CommandHandler
{
    public function __construct(
        private readonly OrderRepository $orders,
        private readonly CommentAuthors $authors,
        private readonly CommentMetaRepository $metas,
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
        $added = [];
        foreach ($command->comments as $line) {
            if (null === $line->id) {
                $comment = new Comment();
                $comment->setUser($this->authors->get($command->authorId));
                $comment->setContent($line->content);
                $order->addComment($comment);
                $this->orders->addComment($comment);
                $added[] = $comment;
                continue;
            }
            if (isset($existing[$line->id])) {
                $existing[$line->id]->setContent($line->content);
                $kept[$line->id] = true;
            }
        }

        $removed = array_diff_key($existing, $kept);
        foreach ($removed as $comment) {
            $order->removeComment($comment);
        }
        foreach ($this->metas->ofComments(array_keys($removed)) as $meta) {
            $meta->unpin();
        }

        if ([] !== $added) {
            // The metadata row's key is the comment's id (a derived identity): the new comments are written first.
            $this->orders->identify($order);
            foreach ($added as $comment) {
                $this->metas->add(new OrderCommentMeta($comment, OrderCommentMeta::ORIGIN_APP));
            }
        }
    }
}
