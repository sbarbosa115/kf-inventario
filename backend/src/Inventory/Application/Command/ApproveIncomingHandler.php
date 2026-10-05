<?php

namespace App\Inventory\Application\Command;

use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Repository\StockRepository;
use App\Inventory\Domain\Repository\WarehouseRepository;
use App\Shared\Application\Command\CommandHandler;

/**
 * The legacy ProductService::approveProducts: every incoming row of the warehouse becomes in stock (as a row of its
 * own, beside any row already in stock, as before).
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
            $row->approve();
        }

        return \count($incoming);
    }
}
