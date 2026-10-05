<?php

namespace App\Ordering\Infrastructure\Persistence;

use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderProduct;
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

    public function identify(Order $order): int
    {
        $this->em->persist($order);
        $this->em->flush();

        return (int) $order->getId();
    }

    public function addComment(Comment $comment): void
    {
        $this->em->persist($comment);
    }

    public function remove(Order $order): void
    {
        $this->em->remove($order);
    }

    public function removeLine(OrderProduct $line): void
    {
        $this->em->remove($line);
    }

    public function removeComment(Comment $comment): void
    {
        $this->em->remove($comment);
    }

    public function ofWarehouse(int $warehouseId): array
    {
        // The legacy list inner-joined the customer, hiding orders without one: a left join now (decision 9).
        /** @var list<Order> $orders */
        $orders = $this->em->createQueryBuilder()
            ->select('o', 'cu', 'co', 'w')
            ->from(Order::class, 'o')
            ->leftJoin('o.customer', 'cu')
            ->leftJoin('o.comments', 'co')
            ->innerJoin('o.warehouse', 'w')
            ->where('w.id = :warehouse')
            ->setParameter('warehouse', $warehouseId)
            ->orderBy('o.id', 'DESC')
            ->getQuery()
            ->getResult();

        return $orders;
    }
}
