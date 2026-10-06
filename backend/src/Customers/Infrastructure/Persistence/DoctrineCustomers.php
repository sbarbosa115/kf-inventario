<?php

namespace App\Customers\Infrastructure\Persistence;

use App\Customers\Application\Query\Customers;
use App\Customers\Domain\Error\CustomerNotFound;
use App\Customers\Domain\Model\Customer;
use App\Customers\Domain\Model\CustomerAddress;
use App\Shared\Application\Query\AnyOfFilter;
use App\Shared\Application\Query\ListFilter;
use App\Shared\Application\Query\ListPage;
use App\Shared\Application\Query\ListQuery;
use App\Shared\Infrastructure\Persistence\ListMapping;
use App\Shared\Infrastructure\Persistence\ListQueryApplier;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Query\Expr\Join;
use Doctrine\ORM\QueryBuilder;

final class DoctrineCustomers implements Customers
{
    private const NAME = "CONCAT(c.firstName, ' ', c.lastName)";

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ListQueryApplier $lists,
    ) {
    }

    public function byId(int $id): Customer
    {
        $customer = $this->withAddresses()
            ->where('c.id = :id')->setParameter('id', $id)
            ->getQuery()->getOneOrNullResult();

        return $customer instanceof Customer ? $customer : throw new CustomerNotFound();
    }

    public function list(ListQuery $query): ListPage
    {
        $page = $this->lists->page($this->listQuery(), $query, self::mapping());

        // Then their addresses, in one query: LIMIT on a query that joins them would cut a customer's in the middle.
        $ids = array_map(static fn (Customer $c): int => (int) $c->getId(), $page->items);
        $loaded = [];
        if ([] !== $ids) {
            /** @var list<Customer> $customers */
            $customers = $this->withAddresses()->where('c.id IN (:ids)')->setParameter('ids', $ids)->getQuery()->getResult();
            foreach ($customers as $customer) {
                $loaded[(int) $customer->getId()] = $customer;
            }
        }
        $items = array_values(array_filter(array_map(static fn (int $id): ?Customer => $loaded[$id] ?? null, $ids)));

        $facets = $page->facets;
        if (\in_array('country', $query->facets, true)) {
            $facets['country'] = $this->countryFacet($query);
        }

        return new ListPage($items, $page->total, $facets);
    }

    /**
     * Customers with their first address's city (the one the list shows): one row per customer.
     */
    private function listQuery(): QueryBuilder
    {
        return $this->em->createQueryBuilder()
            ->select('c')
            ->from(Customer::class, 'c')
            ->leftJoin('c.addresses', 'fa', Join::WITH, \sprintf('fa.id = (SELECT MIN(fa2.id) FROM %s fa2 WHERE fa2.customer = c)', CustomerAddress::class))
            ->leftJoin('fa.city', 'fcity');
    }

    /**
     * The customers list's columns (CustomerController::listSchema()): the city is the first address's, the country
     * any address's.
     */
    private static function mapping(): ListMapping
    {
        return new ListMapping(
            id: 'c.id',
            columns: [
                'name' => self::NAME,
                'email' => 'c.email',
                'phone' => 'c.phone',
                'city' => 'fcity.name',
                'country' => self::countryCondition(...),
            ],
            search: [self::NAME, 'c.email', 'c.phone', 'fcity.name'],
            sorts: ['id' => 'c.id'],
        );
    }

    private static function countryCondition(QueryBuilder $qb, ListFilter $filter, string $param): string
    {
        \assert($filter instanceof AnyOfFilter);
        $qb->setParameter($param, array_map('intval', $filter->values));

        return \sprintf(
            'EXISTS (SELECT %1$sa.id FROM %2$s %1$sa JOIN %1$sa.city %1$sc JOIN %1$sc.state %1$ss WHERE %1$sa.customer = c AND IDENTITY(%1$ss.country) IN (:%1$s))',
            $param,
            CustomerAddress::class,
        );
    }

    /**
     * The customers per country they have an address in, over every filter but the country.
     *
     * @return list<array{value: string, count: int}>
     */
    private function countryFacet(ListQuery $query): array
    {
        $qb = $this->listQuery();
        $this->lists->apply($qb, $query->without('country'), self::mapping());
        /** @var list<array{country: int|string, n: int|string}> $rows */
        $rows = $qb->resetDQLPart('orderBy')
            ->select('IDENTITY(gs.country) AS country', 'COUNT(DISTINCT c.id) AS n')
            ->innerJoin('c.addresses', 'ga')
            ->innerJoin('ga.city', 'gc')
            ->innerJoin('gc.state', 'gs')
            ->groupBy('gs.country')
            ->getQuery()
            ->getArrayResult();

        $counts = [];
        foreach ($rows as $row) {
            $counts[(string) $row['country']] = (int) $row['n'];
        }
        ksort($counts, \SORT_NATURAL);

        return array_map(static fn (string|int $value, int $count): array => ['value' => (string) $value, 'count' => $count], array_keys($counts), array_values($counts));
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
            ->orderBy('c.id', \SortDirection::Ascending)
            ->addOrderBy('a.id', \SortDirection::Ascending);
    }
}
