<?php

namespace App\Ordering\UI\Http\Output;

/**
 * How many of a product are still to ship.
 */
final readonly class PendingLineOutput
{
    public function __construct(
        public string $uuid,
        public int $quantity,
    ) {
    }
}
