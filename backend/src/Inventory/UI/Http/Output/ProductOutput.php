<?php

namespace App\Inventory\UI\Http\Output;

/**
 * A product and its stock per warehouse.
 */
final readonly class ProductOutput
{
    /**
     * @param list<ProductStockOutput> $stock
     */
    public function __construct(
        public int $id,
        public string $uuid,
        public string $code,
        public string $title,
        public ?string $detail,
        /** 1: active; 0: inactive */
        public int $status,
        public ?float $price,
        public array $stock,
    ) {
    }
}
