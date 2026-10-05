<?php

namespace App\Ordering\Infrastructure\Persistence;

use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderStatus;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Event\PostPersistEventArgs;
use Doctrine\ORM\Event\PostUpdateEventArgs;

/**
 * The order's status history (table order_status): a row each time an order (not a partial shipment) is inserted or
 * updated, with its status then. Moved verbatim from the legacy App\EventListener\OrderListener, with the same two
 * Doctrine listener tags (services.yaml): it flushes inside postPersist/postUpdate and adds a row on every update of
 * the order, status changed or not (docs/pdr/prd-restructure.md, "Left out on purpose").
 */
class OrderStatusHistoryListener
{
    /** @var EntityManagerInterface */
    private $manager;

    public function __construct(
        EntityManagerInterface $manager,
    ) {
        $this->manager = $manager;
    }

    public function postPersist(PostPersistEventArgs $event): void
    {
        $order = $event->getObject();

        if ($order instanceof Order && null === $order->getParent()) {
            $this->addOrderStatus($order);
        }
    }

    public function postUpdate(PostUpdateEventArgs $event): void
    {
        $order = $event->getObject();
        if ($order instanceof Order && null === $order->getParent()) {
            $this->addOrderStatus($order);
        }
    }

    protected function addOrderStatus(Order $order): void
    {
        $orderStatus = new OrderStatus();
        $orderStatus->setStatus($order->getStatus());
        $orderStatus->setOrder($order);
        $order->addOrderStatus($orderStatus);

        $this->manager->persist($orderStatus);
        $this->manager->flush();
    }
}
