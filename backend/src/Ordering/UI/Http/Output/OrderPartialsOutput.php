<?php

namespace App\Ordering\UI\Http\Output;

use App\Inventory\UI\Http\Output\StockOutput;

/**
 * An order's partial shipments: what was shipped, what is left, and the warehouse's stock of its products (the getting-ready screen).
 */
final readonly class OrderPartialsOutput
{
    /**
     * @param list<PartialLineOutput> $productsAggregate
     * @param list<PendingLineOutput> $pending
     * @param list<StockOutput>       $inventory
     */
    public function __construct(
        public int $orderId,
        public int $status,
        public array $productsAggregate,
        public array $pending,
        public array $inventory,
    ) {
    }
}
