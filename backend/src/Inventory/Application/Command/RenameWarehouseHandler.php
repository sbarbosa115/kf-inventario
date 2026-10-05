<?php

namespace App\Inventory\Application\Command;

use App\Inventory\Domain\Repository\WarehouseRepository;
use App\Shared\Application\Command\CommandHandler;

final class RenameWarehouseHandler implements CommandHandler
{
    public function __construct(private readonly WarehouseRepository $warehouses)
    {
    }

    public function __invoke(RenameWarehouse $command): void
    {
        $this->warehouses->get($command->warehouseId)->rename($command->name);
    }
}
