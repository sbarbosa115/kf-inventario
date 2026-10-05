<?php

namespace App\Ordering\Application\Port;

use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Application\Command\OrderLine;
use App\Ordering\Domain\Error\NotEnoughStockToShip;
use App\Ordering\Domain\Error\OrderedProductNotFound;
use App\Ordering\Domain\Error\OrderWarehouseNotFound;
use App\Ordering\Domain\Model\Order;

/**
 * What Ordering needs from Inventory: the products and warehouse an order names, the stock of its products, and
 * taking a shipment out of a warehouse.
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
     * The warehouse whose shop sends its WooCommerce webhooks from this address (one of its `urls`).
     */
    public function warehouseOfShop(string $source): ?Warehouse;

    /**
     * The stock rows, in the order's warehouse, of the products the order names (any status).
     *
     * @return list<ProductWarehouse>
     */
    public function stockOf(Order $order): array;

    /**
     * Takes each line out of the warehouse's stock (ProductService::removeProductsFromInventory: a product that no
     * longer exists is skipped).
     *
     * @param list<OrderLine> $lines
     *
     * @throws NotEnoughStockToShip
     */
    public function takeOut(array $lines, Warehouse $warehouse): void;
}
