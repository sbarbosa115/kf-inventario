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

    /**
     * The product's first row in the warehouse, whatever its status (as the legacy ProductService looked it up).
     */
    public function find(Product $product, Warehouse $warehouse): ?ProductWarehouse;

    /**
     * The product's row in the warehouse with that status (1 in stock, 0 incoming).
     */
    public function findWithStatus(Product $product, Warehouse $warehouse, int $status): ?ProductWarehouse;

    /**
     * The warehouse's rows with that status, with their product, by product.
     *
     * @return list<ProductWarehouse>
     */
    public function ofWarehouse(Warehouse $warehouse, int $status): array;

    /**
     * The warehouse's rows of these products (any status), with their product.
     *
     * @param list<string> $uuids
     *
     * @return list<ProductWarehouse>
     */
    public function ofProducts(Warehouse $warehouse, array $uuids): array;

    public function add(ProductWarehouse $stock): void;
}
