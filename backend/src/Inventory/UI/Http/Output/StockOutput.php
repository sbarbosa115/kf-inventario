<?php

namespace App\Inventory\UI\Http\Output;

/**
 * One product's stock in one warehouse (a product_warehouse row), as the stock lists show it.
 */
final readonly class StockOutput
{
    public function __construct(
        /** The stock row */
        public int $id,
        /** 1: in stock; 0: incoming, waiting for approval */
        public int $status,
        public int $quantity,
        public int $productId,
        /** The product's */
        public string $uuid,
        public string $code,
        public string $title,
        public ?string $detail,
        public ?float $price,
        public WarehouseRefOutput $warehouse,
    ) {
    }
}
