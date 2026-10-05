<?php

namespace App\Inventory\Application\Query;

use App\Inventory\Application\Command\StockLine;
use App\Inventory\Domain\Error\InsufficientStock;
use App\Inventory\Domain\Error\ProductNotFound;
use App\Inventory\Domain\Error\StockNotFound;
use App\Inventory\Domain\Error\WarehouseNotFound;
use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Repository\ProductRepository;
use App\Inventory\Domain\Repository\StockRepository;
use App\Inventory\Domain\Repository\WarehouseRepository;

/**
 * A warehouse's stock: what the lists read, and the one stock rule other contexts call (an order shipped takes its
 * products out of its warehouse: Ordering).
 */
final class Stock
{
    public function __construct(
        private readonly StockRepository $stock,
        private readonly WarehouseRepository $warehouses,
        private readonly ProductRepository $products,
    ) {
    }

    /**
     * The warehouse's rows with that status (1 in stock, 0 incoming), with their product, by product.
     *
     * @return list<ProductWarehouse>
     *
     * @throws WarehouseNotFound
     */
    public function ofWarehouse(int $warehouseId, int $status = ProductWarehouse::STATUS_CONFIRMED): array
    {
        return $this->stock->ofWarehouse($this->warehouses->get($warehouseId), $status);
    }

    /**
     * The warehouse's rows of these products, any status (what an order's getting-ready screen shows).
     *
     * @param list<string> $uuids
     *
     * @return list<ProductWarehouse>
     *
     * @throws WarehouseNotFound
     */
    public function ofProducts(int $warehouseId, array $uuids): array
    {
        return $this->stock->ofProducts($this->warehouses->get($warehouseId), $uuids);
    }

    /**
     * Takes the lines out of the warehouse (the legacy ProductService::removeProductsFromInventory): a line whose
     * product does not exist is skipped; a product the warehouse has no row of, or fewer than asked, refuses the
     * whole call. A write, in the caller's command transaction (RemoveStock, an order shipped): never on its own.
     *
     * @param list<StockLine> $lines
     *
     * @throws WarehouseNotFound
     * @throws StockNotFound
     * @throws InsufficientStock
     */
    public function subtract(int $warehouseId, array $lines): void
    {
        $warehouse = $this->warehouses->get($warehouseId);
        foreach ($lines as $line) {
            $product = $this->find($line);
            if (null === $product) {
                continue;
            }
            $this->stock->get($product, $warehouse)->subQuantity($line->quantity);
        }
    }

    private function find(StockLine $line): ?Product
    {
        try {
            return $this->products->getByUuidOrCode($line->uuid, $line->code);
        } catch (ProductNotFound) {
            return null;
        }
    }
}
