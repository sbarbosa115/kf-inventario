<?php

namespace App\Ordering\Application\Command;

/**
 * Moves an order to another status (1 created … 6 delivered).
 */
final readonly class ChangeOrderStatus
{
    public function __construct(
        public int $orderId,
        public int $status,
    ) {
    }
}
