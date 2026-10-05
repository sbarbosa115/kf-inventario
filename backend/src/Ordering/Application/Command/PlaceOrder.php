<?php

namespace App\Ordering\Application\Command;

/**
 * Places an order: typed in the order form, or received from a shop's webhook.
 */
final readonly class PlaceOrder
{
    /**
     * @param list<string> $comments the order's first comments, written by $authorId
     */
    public function __construct(
        public OrderDetails $details,
        public array $comments = [],
        public ?int $authorId = null,
        public bool $notifyPrinter = true,
    ) {
    }
}
