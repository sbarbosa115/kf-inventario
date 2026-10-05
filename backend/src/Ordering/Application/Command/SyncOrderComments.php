<?php

namespace App\Ordering\Application\Command;

/**
 * Makes an order's comments what the list says: new ones added (signed by the author), existing ones edited, the
 * missing ones taken off the order.
 */
final readonly class SyncOrderComments
{
    /**
     * @param list<CommentLine> $comments
     */
    public function __construct(
        public int $orderId,
        public array $comments,
        public int $authorId,
    ) {
    }
}
