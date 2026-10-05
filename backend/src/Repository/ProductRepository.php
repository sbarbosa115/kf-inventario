<?php

namespace App\Repository;

use App\Entity\Product;
use App\Entity\Warehouse;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\Query;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @method Product|null find($id, $lockMode = null, $lockVersion = null)
 * @method Product|null findOneBy(array $criteria, array $orderBy = null)
 * @method Product[]    findAll()
 * @method Product[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class ProductRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Product::class);
    }

    /**
     * @return Product[]
     */
    public function findAllAsArray(Warehouse $warehouse): array
    {
        return $this->createQueryBuilder('p')
            ->select('p,w')
            ->innerJoin('p.warehouse', 'w')
            ->where('p.warehouse = :warehouse')
            ->setParameter('warehouse', $warehouse)
            ->getQuery()
            ->getResult(Query::HYDRATE_ARRAY);
    }

    public function findByUuids(array $uuids): array
    {
        return $this->createQueryBuilder('p')
            ->select('p')
            ->where('p.uuid in (:uuids)')
            ->setParameter('uuids', implode(',', $uuids))
            ->getQuery()
            ->getResult();
    }
}
