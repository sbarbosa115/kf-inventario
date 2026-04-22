<?php

namespace App\Repository;

use App\Entity\Order;
use App\Entity\Warehouse;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @method Order|null find($id, $lockMode = null, $lockVersion = null)
 * @method Order|null findOneBy(array $criteria, array $orderBy = null)
 * @method Order[]    findAll()
 * @method Order[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class OrderRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Order::class);
    }

    public function findByWarehouse(Warehouse $warehouse): array
    {
        $products = $this->createQueryBuilder('o')
            ->select('o,cu,co')
            ->innerJoin('o.customer', 'cu')
            ->leftJoin('o.comments', 'co')
            ->where('o.warehouse = :warehouse')
            ->setParameter('warehouse', $warehouse)
            ->orderBy('o.id', 'DESC')
            ->getQuery()
            ->getArrayResult();

        return $products;
    }
}
