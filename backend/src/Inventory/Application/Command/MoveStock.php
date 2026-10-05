<?php

namespace App\Inventory\Application\Command;

/**
 * Products sent from one warehouse to another, where they arrive as incoming until approved.
 */
final readonly class MoveStock
{
    /**
     * @param list<StockLine> $lines
     */
    public function __construct(
        public int $fromWarehouseId,
        public int $toWarehouseId,
        public array $lines,
    ) {
    }
}
