<?php

namespace App\Invoicing\Infrastructure\Persistence;

use App\Invoicing\Application\Query\InvoiceList;
use App\Invoicing\Domain\Model\Invoice;
use App\Shared\Application\Query\AnyOfFilter;
use App\Shared\Application\Query\ListFilter;
use App\Shared\Application\Query\ListPage;
use App\Shared\Application\Query\ListQuery;
use App\Shared\Infrastructure\Persistence\ListMapping;
use App\Shared\Infrastructure\Persistence\ListQueryApplier;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\QueryBuilder;

final class DoctrineInvoiceList implements InvoiceList
{
    /** The customer's full name; a walk-in invoice has none. */
    private const CUSTOMER_NAME = "CONCAT(COALESCE(c.firstName, ''), ' ', COALESCE(c.lastName, ''))";

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ListQueryApplier $lists,
    ) {
    }

    public function page(ListQuery $query): ListPage
    {
        $page = $this->lists->page($this->invoices(), $query, self::mapping());

        // Then their lines, in one query, in the order they were written.
        $ids = array_map(static fn (Invoice $i): int => (int) $i->getId(), $page->items);
        if ([] !== $ids) {
            $this->em->createQueryBuilder()
                ->select('i', 'it', 'p')
                ->from(Invoice::class, 'i')
                ->leftJoin('i.items', 'it')
                ->leftJoin('it.product', 'p')
                ->where('i.id IN (:ids)')
                ->setParameter('ids', $ids)
                ->orderBy('it.id', 'ASC')
                ->getQuery()
                ->getResult();
        }

        $facets = $page->facets;
        if (\in_array('walk_in', $query->facets, true)) {
            $facets['walk_in'] = $this->walkInFacet($query);
        }

        /** @var list<Invoice> $invoices */
        $invoices = $page->items;

        return new ListPage($invoices, $page->total, $facets);
    }

    /**
     * Invoices with their customer, when they have one.
     */
    private function invoices(): QueryBuilder
    {
        return $this->em->createQueryBuilder()
            ->select('i', 'c')
            ->from(Invoice::class, 'i')
            ->leftJoin('i.customer', 'c');
    }

    /**
     * The invoices list's columns (InvoiceController::listSchema()): `customer` is the name or the email; `walk_in`
     * yes is an invoice without a customer.
     */
    private static function mapping(): ListMapping
    {
        return new ListMapping(
            id: 'i.id',
            columns: [
                'code' => 'i.code',
                'customer' => [self::CUSTOMER_NAME, 'c.email'],
                'payment_method' => 'i.paymentMethod',
                'created_at' => 'i.createdAt',
                'total' => 'i.total',
                'walk_in' => self::walkInCondition(...),
            ],
            search: ['i.code', self::CUSTOMER_NAME, 'c.email'],
            sorts: ['customer' => self::CUSTOMER_NAME],
        );
    }

    private static function walkInCondition(QueryBuilder $qb, ListFilter $filter, string $param): ?string
    {
        \assert($filter instanceof AnyOfFilter);
        $yes = \in_array('yes', $filter->values, true);
        $no = \in_array('no', $filter->values, true);

        return match (true) {
            $yes && $no => null,
            $yes => 'c.id IS NULL',
            default => 'c.id IS NOT NULL',
        };
    }

    /**
     * The walk-in counts over every filter but its own.
     *
     * @return list<array{value: string, count: int}>
     */
    private function walkInFacet(ListQuery $query): array
    {
        $qb = $this->invoices();
        $this->lists->apply($qb, $query->without('walk_in'), self::mapping());
        /** @var array{yes: int|string|null, total: int|string} $counts */
        $counts = $qb->resetDQLPart('orderBy')
            ->select('SUM(CASE WHEN c.id IS NULL THEN 1 ELSE 0 END) AS yes', 'COUNT(i.id) AS total')
            ->getQuery()
            ->getSingleResult();
        $yes = (int) $counts['yes'];
        $no = (int) $counts['total'] - $yes;

        return array_values(array_filter(
            [['value' => 'no', 'count' => $no], ['value' => 'yes', 'count' => $yes]],
            static fn (array $facet): bool => $facet['count'] > 0,
        ));
    }
}
