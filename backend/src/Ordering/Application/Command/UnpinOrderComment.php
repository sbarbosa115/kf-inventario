<?php

namespace App\Ordering\Application\Command;

/** Takes the pin off the comment (nothing happens when it is not pinned). */
final readonly class UnpinOrderComment
{
    public function __construct(
        public int $orderId,
        public int $commentId,
    ) {
    }
}
