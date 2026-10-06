<?php

namespace App\Ordering\Application\Port;

use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Application\Command\OrderLine;
use App\Ordering\Domain\Error\OrderedProductNotFound;
use App\Ordering\Domain\Error\OrderWarehouseNotFound;
use App\Ordering\Domain\Model\Order;

/**
 * What Ordering needs from Inventory: the products and warehouse an order names, the stock of its products, and
 * taking a shipment out of a warehouse. The rules are Inventory's (its Application layer); the adapter delegates.
 */
interface OrderInventory
{
    /**
     * @throws OrderedProductNotFound
     */
    public function product(?string $uuid, ?string $code): Product;

    /**
     * @throws OrderWarehouseNotFound
     */
    public function warehouse(int $id): Warehouse;

    /**
     * The stock rows, in the order's warehouse, of the products the order names (any status).
     *
     * @return list<ProductWarehouse>
     */
    public function stockOf(Order $order): array;

    /**
     * Takes each line out of the warehouse's stock (Inventory's Stock::subtract, the legacy
     * ProductService::removeProductsFromInventory: a product that no longer exists is skipped). Inventory's refusals
     * pass through as they are: `insufficient_stock` (422, detail {code, available}) when the warehouse holds fewer
     * than a line asks, `stock_not_found` (404) when it has no row of that product at all.
     *
     * @param list<OrderLine> $lines
     */
    public function takeOut(array $lines, Warehouse $warehouse): void;
}
