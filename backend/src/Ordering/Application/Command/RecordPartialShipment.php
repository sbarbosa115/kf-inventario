<?php

namespace App\Ordering\Application\Command;

/**
 * What the getting-ready screen ships now, per product.
 */
final readonly class RecordPartialShipment
{
    /**
     * @param list<OrderLine> $lines
     */
    public function __construct(
        public int $orderId,
        public array $lines,
    ) {
    }
}
