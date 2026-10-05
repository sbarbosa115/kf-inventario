<?php

namespace App\Inventory\Domain\Error;

use App\Shared\Domain\Error\NotFound;

final class WarehouseNotFound extends NotFound
{
    public function __construct()
    {
        parent::__construct('warehouse_not_found', 'Warehouse not found.');
    }
}
