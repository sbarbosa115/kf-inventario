<?php

namespace App\Inventory\Application\Command;

final readonly class RenameWarehouse
{
    public function __construct(
        public int $warehouseId,
        public string $name,
    ) {
    }
}
