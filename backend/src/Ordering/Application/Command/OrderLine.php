<?php

namespace App\Ordering\Application\Command;

/**
 * A product of an order or of a shipment (by uuid, or by code when there is no uuid: a shop's SKU) and how many.
 */
final readonly class OrderLine
{
    public function __construct(
        public ?string $uuid,
        public ?string $code,
        public int $quantity,
    ) {
    }
}
