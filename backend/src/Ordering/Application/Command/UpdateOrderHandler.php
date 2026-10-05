<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Domain\Error\OrderedProductNotFound;
use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Error\OrderWarehouseNotFound;
use App\Ordering\Domain\Error\OrderWithoutProducts;
use App\Ordering\Domain\Repository\OrderRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;

/**
 * Legacy OrderService::update and the controller's log row. A status change through the form adds an order_status
 * row (OrderStatusHistoryListener), as before.
 */
final class UpdateOrderHandler implements CommandHandler
{
    public function __construct(
        private readonly OrderWriter $writer,
        private readonly OrderRepository $orders,
        private readonly ActivityLog $activity,
    ) {
    }

    /**
     * @throws OrderNotFound|OrderWithoutProducts|OrderedProductNotFound|OrderWarehouseNotFound
     */
    public function __invoke(UpdateOrder $command): void
    {
        $order = $this->orders->get($command->orderId);
        $this->writer->write($order, $command->details);

        $this->activity->record('Order', 'Order updated', OrderWriter::summary($order));
    }
}
