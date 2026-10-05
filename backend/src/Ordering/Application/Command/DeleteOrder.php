<?php

namespace App\Ordering\Application\Command;

final readonly class DeleteOrder
{
    public function __construct(
        public int $orderId,
    ) {
    }
}
