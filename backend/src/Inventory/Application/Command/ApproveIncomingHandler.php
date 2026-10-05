<?php

namespace App\Inventory\Application\Command;

use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Repository\StockRepository;
use App\Inventory\Domain\Repository\WarehouseRepository;
use App\Shared\Application\Command\CommandHandler;

/**
 * Every incoming row of the warehouse becomes in stock. When the product already has a row in stock there, the
 * incoming quantity is added to it and the incoming row goes: one row in stock per product and warehouse. (The legacy
 * ProductService::approveProducts kept both rows, and every later lookup read only the first.).
 */
final class ApproveIncomingHandler implements CommandHandler
{
    public function __construct(
        private readonly WarehouseRepository $warehouses,
        private readonly StockRepository $stock,
    ) {
    }

    /**
     * @return int how many rows were approved
     */
    public function __invoke(ApproveIncoming $command): int
    {
        $incoming = $this->stock->ofWarehouse($this->warehouses->get($command->warehouseId), ProductWarehouse::STATUS_PENDING_TO_CONFIRM);
        foreach ($incoming as $row) {
            $inStock = $this->stock->findWithStatus($row->getProduct(), $row->getWarehouse(), ProductWarehouse::STATUS_CONFIRMED);
            if (null === $inStock) {
                $row->approve();
                continue;
            }
            $inStock->addQuantity($row->getQuantity());
            $this->stock->remove($row);
        }

        return \count($incoming);
    }
}
