<?php

namespace App\Ordering\UI\Http\Output;

/**
 * How many of a product were shipped so far, over every partial shipment.
 */
final readonly class PartialLineOutput
{
    public function __construct(
        public string $uuid,
        public int $quantity,
        public PartialLineProductOutput $product,
    ) {
    }
}
