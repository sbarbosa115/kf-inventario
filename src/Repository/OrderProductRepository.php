<?php

namespace App\Repository;

use App\Entity\Order;
use App\Entity\OrderProduct;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @method OrderProduct|null find($id, $lockMode = null, $lockVersion = null)
 * @method OrderProduct|null findOneBy(array $criteria, array $orderBy = null)
 * @method OrderProduct[]    findAll()
 * @method OrderProduct[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class OrderProductRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, OrderProduct::class);
    }

    public function allProductsByOrder(Order $order): array
    {
        $products = $this->createQueryBuilder('op')
            ->select('op,p')
            ->innerJoin('op.order', 'o')
            ->innerJoin('op.product', 'p')
            ->where('o.id = :order')
            ->setParameter('order', $order->getId())
            ->getQuery()
            ->getArrayResult();

        return $products;
    }
}
