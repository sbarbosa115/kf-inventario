<?php

namespace App\Ordering\UI\Http\Output;

/**
 * One product of an order and how many.
 */
final readonly class OrderLineOutput
{
    public function __construct(
        /** The product's */
        public string $uuid,
        public int $quantity,
        public OrderLineProductOutput $product,
    ) {
    }
}
