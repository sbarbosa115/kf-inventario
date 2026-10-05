<?php

namespace App\Inventory\Application\Command;

use App\Inventory\Application\Query\Stock;
use App\Inventory\Domain\Repository\WarehouseRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;

final class RemoveStockHandler implements CommandHandler
{
    public function __construct(
        private readonly WarehouseRepository $warehouses,
        private readonly Stock $stock,
        private readonly ActivityLog $log,
    ) {
    }

    public function __invoke(RemoveStock $command): void
    {
        $warehouse = $this->warehouses->get($command->warehouseId);
        $this->stock->subtract($command->warehouseId, $command->lines);

        $this->log->record('Product', \sprintf('Removed %d products to %s', \count($command->lines), $warehouse->getName()), [
            'data' => array_map(static fn (StockLine $line): array => $line->toArray(), $command->lines),
        ]);
    }
}
