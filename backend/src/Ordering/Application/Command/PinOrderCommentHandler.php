<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Application\Port\CommentAuthors;
use App\Ordering\Application\Query\OrderComments;
use App\Ordering\Domain\Error\CommentNotFound;
use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\OrderCommentMeta;
use App\Ordering\Domain\Repository\CommentMetaRepository;
use App\Ordering\Domain\Repository\OrderRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Domain\Clock;

/**
 * One pinned comment per order (docs/pdr/prd-shops-settings.md, Decisions 14): pinning a comment unpins whichever
 * other comment of the order was pinned. A comment without a metadata row (written before the timeline) gets one,
 * as an `app` comment.
 */
final class PinOrderCommentHandler implements CommandHandler
{
    public function __construct(
        private readonly OrderRepository $orders,
        private readonly OrderComments $comments,
        private readonly CommentMetaRepository $metas,
        private readonly CommentAuthors $authors,
        private readonly Clock $clock,
    ) {
    }

    /**
     * @throws OrderNotFound|CommentNotFound
     */
    public function __invoke(PinOrderComment $command): void
    {
        $order = $this->orders->get($command->orderId);
        $comment = $this->comments->of($order, $command->commentId);

        $metas = $this->metas->ofComments(array_map(static fn (Comment $c): int => (int) $c->getId(), $order->getComments()->getValues()));
        foreach ($metas as $commentId => $meta) {
            if ($commentId !== $command->commentId && $meta->isPinned()) {
                $meta->unpin();
            }
        }

        $meta = $metas[$command->commentId] ?? null;
        if (null === $meta) {
            $meta = new OrderCommentMeta($comment, OrderCommentMeta::ORIGIN_APP);
            $this->metas->add($meta);
        }
        $meta->pin($this->clock->now(), $this->authors->get($command->userId));
    }
}
