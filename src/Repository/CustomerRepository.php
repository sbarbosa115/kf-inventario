<?php

namespace App\Repository;

use App\Entity\Customer;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\Query;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @method Customer|null find($id, $lockMode = null, $lockVersion = null)
 * @method Customer|null findOneBy(array $criteria, array $orderBy = null)
 * @method Customer[]    findAll()
 * @method Customer[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class CustomerRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Customer::class);
    }

    public function countAll(): int
    {
        return (int) $this->createQueryBuilder('c')
            ->select('COUNT(c.id)')
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * Fetches a page of Customer objects with associations eager-loaded.
     * Uses a two-step query (IDs first, then full fetch) to avoid LIMIT issues with JOINs.
     *
     * @return Customer[]
     */
    public function findPaginated(int $page, int $limit): array
    {
        $ids = $this->createQueryBuilder('c')
            ->select('c.id')
            ->orderBy('c.id', 'ASC')
            ->setFirstResult(($page - 1) * $limit)
            ->setMaxResults($limit)
            ->getQuery()
            ->getScalarResult();

        $ids = array_column($ids, 'id');

        if (empty($ids)) {
            return [];
        }

        return $this->createQueryBuilder('c')
            ->select('c, a, city, state, country')
            ->leftJoin('c.addresses', 'a')
            ->leftJoin('a.city', 'city')
            ->leftJoin('city.state', 'state')
            ->leftJoin('state.country', 'country')
            ->where('c.id IN (:ids)')
            ->setParameter('ids', $ids)
            ->orderBy('c.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * @return Customer[]
     */
    public function findAllAsArray(): array
    {
        return $this->createQueryBuilder('c')
            ->select('c,a,city,state,country')
            ->innerJoin('c.addresses', 'a')
            ->innerJoin('a.city', 'city')
            ->innerJoin('city.state', 'state')
            ->innerJoin('state.country', 'country')
            ->getQuery()
            ->getResult(Query::HYDRATE_ARRAY);
    }

//    /**
//     * @return Customer[] Returns an array of Customer objects
//     */
    /*
    public function findByExampleField($value)
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.exampleField = :val')
            ->setParameter('val', $value)
            ->orderBy('c.id', 'ASC')
            ->setMaxResults(10)
            ->getQuery()
            ->getResult()
        ;
    }
    */

    /*
    public function findOneBySomeField($value): ?Customer
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.exampleField = :val')
            ->setParameter('val', $value)
            ->getQuery()
            ->getOneOrNullResult()
        ;
    }
    */
}
