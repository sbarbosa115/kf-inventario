<?php

namespace App\Ordering\Application\Query;

use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Repository\OrderRepository;
use App\Shared\Application\Query\ListPage;
use App\Shared\Application\Query\ListQuery;

/**
 * What the orders screens read.
 */
final class Orders
{
    public function __construct(
        private readonly OrderRepository $orders,
        private readonly OrderList $list,
    ) {
    }

    /**
     * A page of a warehouse's orders: filtered, sorted and counted in the database.
     *
     * @return ListPage<Order>
     */
    public function page(int $warehouseId, ListQuery $query): ListPage
    {
        return $this->list->page($warehouseId, $query);
    }

    /**
     * @throws OrderNotFound
     */
    public function get(int $id): Order
    {
        return $this->orders->get($id);
    }
}
