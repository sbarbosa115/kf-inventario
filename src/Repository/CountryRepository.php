<?php

namespace App\Repository;

use App\Entity\Country;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @method Country|null find($id, $lockMode = null, $lockVersion = null)
 * @method Country|null findOneBy(array $criteria, array $orderBy = null)
 * @method Country[]    findAll()
 * @method Country[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class CountryRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Country::class);
    }

    public function findAllAsArray(): array
    {
        return $this->createQueryBuilder('c')
            ->select('c,s,ci')
            ->innerJoin('c.states', 's')
            ->leftJoin('s.cities', 'ci')
            ->orderBy('c.id', 'ASC')
            ->getQuery()
            ->getArrayResult();
    }

    public function findOneByIdOrName(int $id = null, string $name = null): ?Country
    {
        $query = $this->createQueryBuilder('c');
        if (null !== $id) {
            $query->where('c.id = :id')
                ->setParameter('id', $id);
        } elseif (null !== $name) {
            $query
                ->where('c.name = :name')
                ->orWhere('c.code = :code')
                ->setParameter('name', $name)
                ->setParameter('code', $name);
        }

        return $query->getQuery()->getOneOrNullResult();
    }

    /*
    public function findOneBySomeField($value): ?Country
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
