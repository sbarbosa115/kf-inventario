<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Application\Query\OrderComments;
use App\Ordering\Domain\Error\CommentNotFound;
use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Repository\CommentMetaRepository;
use App\Ordering\Domain\Repository\OrderRepository;
use App\Shared\Application\Command\CommandHandler;

/** The order is left with no pinned comment; unpinning one that is not pinned changes nothing. */
final class UnpinOrderCommentHandler implements CommandHandler
{
    public function __construct(
        private readonly OrderRepository $orders,
        private readonly OrderComments $comments,
        private readonly CommentMetaRepository $metas,
    ) {
    }

    /**
     * @throws OrderNotFound|CommentNotFound
     */
    public function __invoke(UnpinOrderComment $command): void
    {
        $order = $this->orders->get($command->orderId);
        $comment = $this->comments->of($order, $command->commentId);

        $this->metas->ofComment((int) $comment->getId())?->unpin();
    }
}
