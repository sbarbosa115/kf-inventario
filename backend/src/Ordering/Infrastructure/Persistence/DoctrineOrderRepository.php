<?php

namespace App\Ordering\Infrastructure\Persistence;

use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Repository\OrderRepository;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineOrderRepository implements OrderRepository
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function get(int $id): Order
    {
        return $this->em->find(Order::class, $id) ?? throw new OrderNotFound();
    }

    public function add(Order $order): void
    {
        $this->em->persist($order);
    }

    public function remove(Order $order): void
    {
        $this->em->remove($order);
    }
}
