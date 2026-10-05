<?php

namespace App\Ordering\Infrastructure\Inventory;

use App\Inventory\Application\Command\StockLine;
use App\Inventory\Application\Query\Products;
use App\Inventory\Application\Query\Stock;
use App\Inventory\Application\Query\Warehouses;
use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Application\Command\OrderLine;
use App\Ordering\Application\Port\OrderInventory;
use App\Ordering\Domain\Error\OrderedProductNotFound;
use App\Ordering\Domain\Error\OrderWarehouseNotFound;
use App\Ordering\Domain\Model\Order;
use App\Shared\Domain\Error\NotFound;

/**
 * What an order needs from Inventory, by Inventory's own rules (its Application layer: Products, Warehouses, Stock),
 * in the caller's command transaction. This adapter only translates: Ordering's lines into Inventory's StockLines,
 * and a product or warehouse not found into Ordering's errors (same codes; the product one names the uuid or SKU).
 */
final class InventoryOrderStock implements OrderInventory
{
    public function __construct(
        private readonly Products $products,
        private readonly Warehouses $warehouses,
        private readonly Stock $stock,
    ) {
    }

    public function product(?string $uuid, ?string $code): Product
    {
        try {
            return $this->products->byUuidOrCode($uuid, $code);
        } catch (NotFound $e) {
            throw new OrderedProductNotFound((string) ($uuid ?? $code), $e);
        }
    }

    public function warehouse(int $id): Warehouse
    {
        try {
            return $this->warehouses->get($id);
        } catch (NotFound $e) {
            throw new OrderWarehouseNotFound($e);
        }
    }

    public function warehouseOfShop(string $source): ?Warehouse
    {
        return $this->warehouses->byWebhookSource($source);
    }

    public function stockOf(Order $order): array
    {
        $warehouse = $order->getWarehouse();
        if (null === $warehouse || null === $warehouse->getId()) {
            return [];
        }

        return $this->stock->ofProducts($warehouse->getId(), $order->getOrderProductsUuids());
    }

    public function takeOut(array $lines, Warehouse $warehouse): void
    {
        $this->stock->subtract(
            (int) $warehouse->getId(),
            array_map(static fn (OrderLine $line) => new StockLine($line->uuid, $line->code, $line->quantity), $lines),
        );
    }
}
