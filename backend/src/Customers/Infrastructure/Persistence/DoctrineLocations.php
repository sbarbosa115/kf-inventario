<?php

namespace App\Customers\Infrastructure\Persistence;

use App\Customers\Application\Query\Locations;
use App\Customers\Domain\Model\Country;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineLocations implements Locations
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function tree(): array
    {
        /** @var list<Country> $countries */
        $countries = $this->em->createQueryBuilder()
            ->select('c', 's', 'ci')
            ->from(Country::class, 'c')
            ->innerJoin('c.states', 's')
            ->leftJoin('s.cities', 'ci')
            ->orderBy('c.id', 'ASC')
            ->addOrderBy('s.id', 'ASC')
            ->addOrderBy('ci.id', 'ASC')
            ->getQuery()->getResult();

        return $countries;
    }
}
