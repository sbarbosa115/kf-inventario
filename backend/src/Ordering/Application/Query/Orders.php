<?php

namespace App\Ordering\Application\Query;

use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Repository\OrderRepository;

/**
 * What the orders screens read.
 */
final class Orders
{
    public function __construct(private readonly OrderRepository $orders)
    {
    }

    /**
     * A warehouse's orders, newest first (the list filters and pages them in the browser, as before).
     *
     * @return list<Order>
     */
    public function ofWarehouse(int $warehouseId): array
    {
        return $this->orders->ofWarehouse($warehouseId);
    }

    /**
     * @throws OrderNotFound
     */
    public function get(int $id): Order
    {
        return $this->orders->get($id);
    }
}
