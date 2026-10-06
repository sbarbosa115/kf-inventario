<?php

namespace App\Inventory\Infrastructure\Persistence;

use App\Inventory\Application\Query\StockList;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Model\Warehouse;
use App\Shared\Application\Query\AnyOfFilter;
use App\Shared\Application\Query\ListFilter;
use App\Shared\Application\Query\ListPage;
use App\Shared\Application\Query\ListQuery;
use App\Shared\Infrastructure\Persistence\ListMapping;
use App\Shared\Infrastructure\Persistence\ListQueryApplier;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\QueryBuilder;

final class DoctrineStockList implements StockList
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ListQueryApplier $lists,
    ) {
    }

    public function page(Warehouse $warehouse, int $status, ListQuery $query): ListPage
    {
        $page = $this->lists->page($this->rows($warehouse, $status), $query, self::mapping());

        $facets = $page->facets;
        if (\in_array('in_stock', $query->facets, true)) {
            $facets['in_stock'] = $this->inStockFacet($warehouse, $status, $query);
        }

        /** @var list<ProductWarehouse> $rows */
        $rows = $page->items;

        return new ListPage($rows, $page->total, $facets);
    }

    public function totals(Warehouse $warehouse, int $status, ListQuery $query): array
    {
        $qb = $this->rows($warehouse, $status);
        $this->lists->apply($qb, $query, self::mapping());
        /** @var array{units: int|string|null, value: float|string|null} $sums */
        $sums = $qb->resetDQLPart('orderBy')
            ->select('SUM(pw.quantity) AS units', 'SUM(pw.quantity * COALESCE(p.price, 0)) AS value')
            ->getQuery()
            ->getSingleResult();

        return ['units' => (int) $sums['units'], 'value' => round((float) $sums['value'], 2)];
    }

    /**
     * The warehouse's rows of that status, with their product (and warehouse, which the row's output names).
     */
    private function rows(Warehouse $warehouse, int $status): QueryBuilder
    {
        return $this->em->createQueryBuilder()
            ->select('pw', 'p', 'w')
            ->from(ProductWarehouse::class, 'pw')
            ->innerJoin('pw.product', 'p')
            ->innerJoin('pw.warehouse', 'w')
            ->where('pw.warehouse = :warehouse')
            ->andWhere('pw.status = :status')
            ->setParameter('warehouse', $warehouse)
            ->setParameter('status', $status);
    }

    /**
     * The stock list's columns (StockController::listSchema()); `in_stock` is yes when the row holds units.
     */
    private static function mapping(): ListMapping
    {
        return new ListMapping(
            id: 'pw.id',
            columns: [
                'code' => 'p.code',
                'title' => 'p.title',
                'detail' => 'p.detail',
                'quantity' => 'pw.quantity',
                'price' => 'p.price',
                'in_stock' => self::inStockCondition(...),
            ],
            search: ['p.code', 'p.title', 'p.detail'],
        );
    }

    private static function inStockCondition(QueryBuilder $qb, ListFilter $filter, string $param): ?string
    {
        \assert($filter instanceof AnyOfFilter);
        $yes = \in_array('yes', $filter->values, true);
        $no = \in_array('no', $filter->values, true);

        return match (true) {
            $yes && $no => null,
            $yes => 'pw.quantity > 0',
            default => '(pw.quantity IS NULL OR pw.quantity <= 0)',
        };
    }

    /**
     * The in-stock counts over every filter but its own.
     *
     * @return list<array{value: string, count: int}>
     */
    private function inStockFacet(Warehouse $warehouse, int $status, ListQuery $query): array
    {
        $qb = $this->rows($warehouse, $status);
        $this->lists->apply($qb, $query->without('in_stock'), self::mapping());
        /** @var array{yes: int|string|null, total: int|string} $counts */
        $counts = $qb->resetDQLPart('orderBy')
            ->select('SUM(CASE WHEN pw.quantity > 0 THEN 1 ELSE 0 END) AS yes', 'COUNT(pw.id) AS total')
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
