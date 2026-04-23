<?php

namespace App\Repository;

use App\Entity\State;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @method State|null find($id, $lockMode = null, $lockVersion = null)
 * @method State|null findOneBy(array $criteria, array $orderBy = null)
 * @method State[]    findAll()
 * @method State[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class StateRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, State::class);
    }

    public function findOneByIdOrName(?int $id = null, ?string $name = null): ?State
    {
        $query = $this->createQueryBuilder('s');

        if (null !== $id) {
            $query->where('s.id = :id')->setParameter('id', $id);
        } elseif (null !== $name) {
            $query
                ->where('s.name = :name')
                ->orWhere('s.code = :code')
                ->setParameter('name', $name)
                ->setParameter('code', $name);
        }

        return $query->getQuery()->getOneOrNullResult();
    }

    /*
    public function findOneBySomeField($value): ?State
    {
        return $this->createQueryBuilder('s')
            ->andWhere('s.exampleField = :val')
            ->setParameter('val', $value)
            ->getQuery()
            ->getOneOrNullResult()
        ;
    }
    */
}
