<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Repository\OrderRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;

/**
 * Legacy OrderController::changeStatus: the new status, its order_status row (OrderStatusHistoryListener), a log row.
 * Stock is not touched (as before: "sent" by hand does not take the products out).
 */
final class ChangeOrderStatusHandler implements CommandHandler
{
    public function __construct(
        private readonly OrderRepository $orders,
        private readonly ActivityLog $activity,
    ) {
    }

    /**
     * @throws OrderNotFound
     */
    public function __invoke(ChangeOrderStatus $command): void
    {
        $order = $this->orders->get($command->orderId);
        $order->setStatus($command->status);

        $this->activity->record('Order', "Order {$order->getCode()} status was changed.");
    }
}
