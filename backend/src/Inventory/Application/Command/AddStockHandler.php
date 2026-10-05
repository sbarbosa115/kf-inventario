<?php

namespace App\Inventory\Application\Command;

use App\Inventory\Domain\Error\ProductNotFound;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Repository\ProductRepository;
use App\Inventory\Domain\Repository\StockRepository;
use App\Inventory\Domain\Repository\WarehouseRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;

/**
 * The legacy ProductService::addProductsToInventory: an unknown product is skipped, a product the warehouse has no row
 * of gets one in stock, and the quantity is added to the row.
 */
final class AddStockHandler implements CommandHandler
{
    public function __construct(
        private readonly WarehouseRepository $warehouses,
        private readonly ProductRepository $products,
        private readonly StockRepository $stock,
        private readonly ActivityLog $log,
    ) {
    }

    public function __invoke(AddStock $command): void
    {
        $warehouse = $this->warehouses->get($command->warehouseId);

        foreach ($command->lines as $line) {
            try {
                $product = $this->products->getByUuidOrCode($line->uuid, $line->code);
            } catch (ProductNotFound) {
                continue;
            }

            $row = $this->stock->find($product, $warehouse);
            if (null === $row) {
                $row = new ProductWarehouse();
                $row->setProduct($product);
                $row->setWarehouse($warehouse);
                $row->setStatus(ProductWarehouse::STATUS_CONFIRMED);
                $row->setQuantity(0);
                $this->stock->add($row);
            }
            $row->addQuantity($line->quantity);
        }

        $this->log->record('Product', \sprintf('Added %d products to %s', \count($command->lines), $warehouse->getName()), [
            'data' => array_map(static fn (StockLine $line): array => $line->toArray(), $command->lines),
        ]);
    }
}
