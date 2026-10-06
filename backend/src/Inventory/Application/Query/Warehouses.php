<?php

namespace App\Inventory\Application\Query;

use App\Inventory\Domain\Error\WarehouseNotFound;
use App\Inventory\Domain\Model\Warehouse;
use App\Inventory\Domain\Repository\WarehouseRepository;

/**
 * The warehouses, for every picker, and the one a WooCommerce shop sends its orders to (Ordering).
 */
final class Warehouses
{
    public function __construct(private readonly WarehouseRepository $warehouses)
    {
    }

    /**
     * @return list<Warehouse> by id
     */
    public function all(): array
    {
        return $this->warehouses->all();
    }

    /**
     * @throws WarehouseNotFound
     */
    public function get(int $id): Warehouse
    {
        return $this->warehouses->get($id);
    }
}
