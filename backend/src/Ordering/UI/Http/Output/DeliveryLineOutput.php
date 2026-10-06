<?php

namespace App\Ordering\UI\Http\Output;

final readonly class DeliveryLineOutput
{
    public function __construct(
        public ?string $sku,
        public int $quantity,
    ) {
    }
}
