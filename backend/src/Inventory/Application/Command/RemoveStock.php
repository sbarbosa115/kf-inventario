<?php

namespace App\Inventory\Application\Command;

/**
 * The barcode reader takes what it scanned out of a warehouse's stock.
 */
final readonly class RemoveStock
{
    /**
     * @param list<StockLine> $lines
     */
    public function __construct(
        public int $warehouseId,
        public array $lines,
    ) {
    }
}
