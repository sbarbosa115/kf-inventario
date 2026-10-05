<?php

namespace App\Customers\Infrastructure\Persistence;

use App\Customers\Application\Query\Customers;
use App\Customers\Domain\Error\CustomerNotFound;
use App\Customers\Domain\Model\Customer;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\QueryBuilder;

final class DoctrineCustomers implements Customers
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function byId(int $id): Customer
    {
        $customer = $this->withAddresses()
            ->where('c.id = :id')->setParameter('id', $id)
            ->getQuery()->getOneOrNullResult();

        return $customer instanceof Customer ? $customer : throw new CustomerNotFound();
    }

    public function page(int $page, int $perPage): array
    {
        // Two steps: LIMIT on a query that joins the addresses would cut a customer's addresses in the middle.
        /** @var list<array{id: int}> $rows */
        $rows = $this->em->createQueryBuilder()
            ->select('c.id')->from(Customer::class, 'c')
            ->orderBy('c.id', 'ASC')
            ->setFirstResult(($page - 1) * $perPage)->setMaxResults($perPage)
            ->getQuery()->getScalarResult();
        if ([] === $rows) {
            return [];
        }

        /** @var list<Customer> $customers */
        $customers = $this->withAddresses()
            ->where('c.id IN (:ids)')->setParameter('ids', array_column($rows, 'id'))
            ->getQuery()->getResult();

        return $customers;
    }

    public function count(): int
    {
        return (int) $this->em->createQueryBuilder()
            ->select('COUNT(c.id)')->from(Customer::class, 'c')
            ->getQuery()->getSingleScalarResult();
    }

    public function all(): array
    {
        /** @var list<Customer> $customers */
        $customers = $this->withAddresses()->getQuery()->getResult();

        return $customers;
    }

    private function withAddresses(): QueryBuilder
    {
        return $this->em->createQueryBuilder()
            ->select('c', 'a', 'city', 'state', 'country')
            ->from(Customer::class, 'c')
            ->leftJoin('c.addresses', 'a')
            ->leftJoin('a.city', 'city')
            ->leftJoin('city.state', 'state')
            ->leftJoin('state.country', 'country')
            ->orderBy('c.id', 'ASC')
            ->addOrderBy('a.id', 'ASC');
    }
}
