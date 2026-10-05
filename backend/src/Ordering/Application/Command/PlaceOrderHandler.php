<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Application\Port\CommentAuthors;
use App\Ordering\Domain\Error\OrderedProductNotFound;
use App\Ordering\Domain\Error\OrderWarehouseNotFound;
use App\Ordering\Domain\Error\OrderWithoutProducts;
use App\Ordering\Domain\Event\OrderPlaced;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Repository\OrderRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Event\EventBus;
use App\Shared\Application\Port\ActivityLog;

/**
 * Legacy OrderService::add, plus what the legacy controller did around it: the activity log row and the printer's
 * email (now after the commit, on the queue). The first order_status row is OrderStatusHistoryListener's.
 */
final class PlaceOrderHandler implements CommandHandler
{
    public function __construct(
        private readonly OrderWriter $writer,
        private readonly OrderRepository $orders,
        private readonly CommentAuthors $authors,
        private readonly EventBus $events,
        private readonly ActivityLog $activity,
    ) {
    }

    /**
     * @return int the new order's id
     *
     * @throws OrderWithoutProducts|OrderedProductNotFound|OrderWarehouseNotFound
     */
    public function __invoke(PlaceOrder $command): int
    {
        $order = new Order();
        $this->writer->write($order, $command->details);

        if (null !== $command->authorId) {
            $author = $this->authors->get($command->authorId);
            foreach ($command->comments as $content) {
                $comment = new Comment();
                $comment->setContent($content);
                $comment->setUser($author);
                $order->addComment($comment);
                $this->orders->addComment($comment);
            }
        }

        $id = $this->orders->identify($order);

        $this->activity->record('Order', 'Order created', OrderWriter::summary($order));
        $this->events->publish(new OrderPlaced($id, $command->notifyPrinter));

        return $id;
    }
}
