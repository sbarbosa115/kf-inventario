<?php

namespace App\Inventory\UI\Http\Output;

/**
 * How many of a product one warehouse holds.
 */
final readonly class ProductStockOutput
{
    public function __construct(
        public int $warehouseId,
        public int $quantity,
        /** 1: in stock; 0: incoming */
        public int $status,
    ) {
    }
}
