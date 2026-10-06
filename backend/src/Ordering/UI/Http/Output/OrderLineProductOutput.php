<?php

namespace App\Ordering\UI\Http\Output;

/**
 * The product of an order line.
 */
final readonly class OrderLineProductOutput
{
    public function __construct(
        public string $code,
        public string $title,
        public ?string $detail,
    ) {
    }
}
