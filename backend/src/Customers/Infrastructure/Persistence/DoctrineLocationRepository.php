<?php

namespace App\Customers\Infrastructure\Persistence;

use App\Customers\Domain\Model\City;
use App\Customers\Domain\Model\Country;
use App\Customers\Domain\Model\State;
use App\Customers\Domain\Repository\LocationRepository;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineLocationRepository implements LocationRepository
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function findCountry(?int $id, ?string $nameOrCode): ?Country
    {
        return $this->findByIdOrName(Country::class, $id, $nameOrCode, true);
    }

    public function findState(?int $id, ?string $nameOrCode): ?State
    {
        return $this->findByIdOrName(State::class, $id, $nameOrCode, true);
    }

    public function findCity(?int $id, ?string $name): ?City
    {
        return $this->findByIdOrName(City::class, $id, $name, false);
    }

    public function add(Country|State|City $location): void
    {
        $this->em->persist($location);
    }

    /**
     * @template T of object
     *
     * @param class-string<T> $class
     *
     * @return T|null
     */
    private function findByIdOrName(string $class, ?int $id, ?string $name, bool $orCode): ?object
    {
        if (null === $id && null === $name) {
            return null;
        }
        if (null === $id) {
            // Added earlier in this same request, not flushed yet: a query cannot see it.
            foreach ($this->em->getUnitOfWork()->getScheduledEntityInsertions() as $pending) {
                if ($pending instanceof $class && 0 === strcasecmp((string) $pending->getName(), (string) $name)) {
                    return $pending;
                }
            }
        }
        $query = $this->em->createQueryBuilder()->select('l')->from($class, 'l');
        if (null !== $id) {
            $query->where('l.id = :id')->setParameter('id', $id);
        } else {
            $query->where('l.name = :name')->setParameter('name', $name);
            if ($orCode) {
                $query->orWhere('l.code = :name');
            }
        }

        /** @var T|null $found */
        $found = $query->setMaxResults(1)->getQuery()->getOneOrNullResult();

        return $found;
    }
}
