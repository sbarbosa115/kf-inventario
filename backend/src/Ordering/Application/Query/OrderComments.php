<?php

namespace App\Ordering\Application\Query;

use App\Ordering\Domain\Error\CommentNotFound;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\Order;

/**
 * An order's comment timeline (docs/pdr/prd-shops-settings.md, Decisions 14): oldest first by the date each comment
 * shows — its own, or the order's for a legacy comment written before `comment.created_at` was filled — and, on the
 * same date, in the order they were written (their id). Shop notes are comments too, so they fall in place.
 */
final class OrderComments
{
    /**
     * @return list<Comment>
     */
    public function timeline(Order $order): array
    {
        $comments = $order->getComments()->getValues();
        usort($comments, static fn (Comment $a, Comment $b): int => [self::shownAt($a, $order), (int) $a->getId()] <=> [self::shownAt($b, $order), (int) $b->getId()]);

        return $comments;
    }

    /**
     * One of the order's comments; another order's comment is not found through this one.
     *
     * @throws CommentNotFound
     */
    public function of(Order $order, int $commentId): Comment
    {
        foreach ($order->getComments() as $comment) {
            if ($comment->getId() === $commentId) {
                return $comment;
            }
        }

        throw new CommentNotFound();
    }

    /** The comment's date, else the order's (shown as approximate); 0 when neither has one. */
    private static function shownAt(Comment $comment, Order $order): int
    {
        return ($comment->getCreatedAt() ?? $order->getCreatedAt())?->getTimestamp() ?? 0;
    }
}
