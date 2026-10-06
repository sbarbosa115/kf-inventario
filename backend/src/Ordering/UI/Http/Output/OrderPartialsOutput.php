<?php

namespace App\Ordering\UI\Http\Output;

use App\Inventory\UI\Http\Output\StockOutput;

/**
 * An order's partial shipments: its code and lines, what was shipped, what is left, and the warehouse's stock of its
 * products. Everything the getting-ready screen shows, so it needs no order role (the legacy page asked for none).
 */
final readonly class OrderPartialsOutput
{
    /**
     * @param list<OrderLineOutput>   $products
     * @param list<PartialLineOutput> $productsAggregate
     * @param list<PendingLineOutput> $pending
     * @param list<StockOutput>       $inventory
     */
    public function __construct(
        public int $orderId,
        public ?string $code,
        public int $status,
        public array $products,
        public array $productsAggregate,
        public array $pending,
        public array $inventory,
    ) {
    }
}
