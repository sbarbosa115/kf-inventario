<?php

namespace App\Inventory\Application\Command;

/**
 * The barcode reader adds what it scanned to a warehouse's stock.
 */
final readonly class AddStock
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
