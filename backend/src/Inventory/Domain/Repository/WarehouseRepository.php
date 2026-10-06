<?php

namespace App\Inventory\Domain\Repository;

use App\Inventory\Domain\Error\WarehouseNotFound;
use App\Inventory\Domain\Model\Warehouse;

interface WarehouseRepository
{
    /**
     * @throws WarehouseNotFound
     */
    public function get(int $id): Warehouse;

    /**
     * @return list<Warehouse> by id
     */
    public function all(): array;
}
