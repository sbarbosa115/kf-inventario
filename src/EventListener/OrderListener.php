<?php

namespace App\EventListener;

use App\Entity\Order;
use App\Entity\OrderStatus;
use Doctrine\ORM\Event\PostPersistEventArgs;
use Doctrine\ORM\Event\PostUpdateEventArgs;
use Doctrine\ORM\EntityManagerInterface;

class OrderListener
{
    /** @var EntityManagerInterface */
    private $manager;

    public function __construct(
        EntityManagerInterface $manager
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
