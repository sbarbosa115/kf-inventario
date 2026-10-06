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
use App\Shared\Application\Query\ListPage;
use App\Shared\Application\Query\ListQuery;

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
        private readonly StockList $list,
    ) {
    }

    /**
     * A page of the warehouse's rows with that status (1 in stock, 0 incoming): filtered, sorted and counted in the
     * database.
     *
     * @return ListPage<ProductWarehouse>
     *
     * @throws WarehouseNotFound
     */
    public function page(int $warehouseId, int $status, ListQuery $query): ListPage
    {
        return $this->list->page($this->warehouses->get($warehouseId), $status, $query);
    }

    /**
     * The units and value of every row the query's filters keep (the Products KPIs).
     *
     * @return array{units: int, value: float}
     *
     * @throws WarehouseNotFound
     */
    public function totals(int $warehouseId, int $status, ListQuery $query): array
    {
        return $this->list->totals($this->warehouses->get($warehouseId), $status, $query);
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
            self::take($this->stock->get($product, $warehouse), $line->quantity);
        }
    }

    /**
     * Takes a quantity out of a stock row, refusing (with the product's code and what the row holds) more than it
     * holds.
     *
     * @throws InsufficientStock
     */
    public static function take(ProductWarehouse $row, int $quantity): void
    {
        if ($quantity > (int) $row->getQuantity()) {
            throw new InsufficientStock((string) $row->getProduct()?->getCode(), (int) $row->getQuantity());
        }
        $row->subQuantity($quantity);
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
