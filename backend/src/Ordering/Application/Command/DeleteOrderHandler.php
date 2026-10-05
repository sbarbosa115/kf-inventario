<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Repository\OrderRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;

/**
 * Legacy OrderService::deleteOrder, same sequence: its product lines deleted, its comments and then the order removed
 * (Gedmo soft-deletes both: deleted_at). Logged first, as the legacy controller did.
 */
final class DeleteOrderHandler implements CommandHandler
{
    public function __construct(
        private readonly OrderRepository $orders,
        private readonly ActivityLog $activity,
    ) {
    }

    /**
     * @throws OrderNotFound
     */
    public function __invoke(DeleteOrder $command): void
    {
        $order = $this->orders->get($command->orderId);
        $this->activity->record('Order', "Order {$command->orderId} was deleted");

        foreach ($order->getOrderProducts()->toArray() as $line) {
            $order->getOrderProducts()->removeElement($line);
            $this->orders->removeLine($line);
        }
        foreach ($order->getComments() as $comment) {
            $this->orders->removeComment($comment);
        }
        $this->orders->remove($order);
    }
}
