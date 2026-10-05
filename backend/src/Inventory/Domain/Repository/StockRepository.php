<?php

namespace App\Inventory\Domain\Repository;

use App\Inventory\Domain\Error\StockNotFound;
use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Model\Warehouse;

/**
 * A product's stock in one warehouse (table product_warehouse).
 */
interface StockRepository
{
    /**
     * @throws StockNotFound
     */
    public function get(Product $product, Warehouse $warehouse): ProductWarehouse;

    public function find(Product $product, Warehouse $warehouse): ?ProductWarehouse;

    public function add(ProductWarehouse $stock): void;
}
