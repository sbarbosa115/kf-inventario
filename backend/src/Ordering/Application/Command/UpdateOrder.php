<?php

namespace App\Ordering\Application\Command;

/**
 * Edits an order: its customer, warehouse, fields and products (not its comments: SyncOrderComments).
 */
final readonly class UpdateOrder
{
    public function __construct(
        public int $orderId,
        public OrderDetails $details,
    ) {
    }
}
