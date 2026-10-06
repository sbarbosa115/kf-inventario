<?php

namespace App\Ordering\Application\Command;

/** Makes the comment its order's pinned one (the previous one is unpinned). */
final readonly class PinOrderComment
{
    public function __construct(
        public int $orderId,
        public int $commentId,
        public int $userId,
    ) {
    }
}
