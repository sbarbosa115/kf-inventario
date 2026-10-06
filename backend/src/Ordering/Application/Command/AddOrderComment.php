<?php

namespace App\Ordering\Application\Command;

/**
 * A comment added from the order's timeline, signed by its author and dated now: typed, or a quick phrase
 * (`phraseId`); optionally also sent to the order's shop as an order note.
 */
final readonly class AddOrderComment
{
    public function __construct(
        public int $orderId,
        public int $authorId,
        public string $content,
        public bool $sendToShop = false,
        public ?int $phraseId = null,
    ) {
    }
}
