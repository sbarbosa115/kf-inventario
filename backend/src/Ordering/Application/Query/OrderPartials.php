<?php

namespace App\Ordering\Application\Query;

use App\Inventory\Domain\Model\ProductWarehouse;
use App\Ordering\Application\Port\OrderInventory;
use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Repository\OrderRepository;

/**
 * The getting-ready screen: what the partial shipments sent so far, what is left, and the warehouse's stock of the
 * order's products.
 */
final class OrderPartials
{
    public function __construct(
        private readonly OrderRepository $orders,
        private readonly OrderInventory $inventory,
    ) {
    }

    /**
     * @return array{order: Order, aggregate: list<array{quantity: int|null, uuid: string, product: array{code: string}}>, pending: list<array{uuid: string, quantity: int}>, inventory: list<ProductWarehouse>}
     *
     * @throws OrderNotFound
     */
    public function of(int $orderId): array
    {
        $order = $this->orders->get($orderId);

        return [
            'order' => $order,
            'aggregate' => $order->getAggregatePartials(),
            'pending' => $order->getPendingOrderProductsQuantities(),
            'inventory' => $this->inventory->stockOf($order),
        ];
    }
}
