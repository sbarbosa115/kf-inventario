<?php

namespace App\Shared\Infrastructure\Persistence;

use App\Shared\Application\Query\AnyOfFilter;
use App\Shared\Application\Query\DateRangeFilter;
use App\Shared\Application\Query\ListFilter;
use App\Shared\Application\Query\ListPage;
use App\Shared\Application\Query\ListQuery;
use App\Shared\Application\Query\NumberRangeFilter;
use App\Shared\Application\Query\TextFilter;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\QueryBuilder;
use Doctrine\ORM\Tools\Pagination\Paginator;

/**
 * Applies a ListQuery to a Doctrine query (docs/pdr/prd-shops-settings.md, "List query contract"): filters and `q` as
 * conditions with bound parameters (LIKE with %, _ and \ escaped, so they match themselves), dates as Bogota days
 * (the database holds Bogota wall-clock times; `to` is included up to midnight after it), sort with the id as the
 * tie-break, the page, the total, and facets — one GROUP BY per asked enum column, over every filter but its own.
 */
final class ListQueryApplier
{
    private int $parameter = 0;

    /**
     * Filters, `q` and the sort; not the page (page() adds it).
     */
    public function apply(QueryBuilder $qb, ListQuery $query, ListMapping $mapping): void
    {
        $this->filter($qb, $query, $mapping);
        $sort = $query->sort;
        $expression = null === $sort ? null : $mapping->sortExpression($sort->field);
        if (null !== $sort && null !== $expression) {
            $qb->orderBy($expression, $sort->descending ? \SortDirection::Descending : \SortDirection::Ascending);
            $qb->addOrderBy($mapping->id, $sort->descending ? \SortDirection::Descending : \SortDirection::Ascending);
        } else {
            $qb->orderBy($mapping->id, \SortDirection::Descending);
        }
    }

    /**
     * The page of rows, the total and the facets asked for.
     *
     * @return ListPage<mixed>
     */
    public function page(QueryBuilder $qb, ListQuery $query, ListMapping $mapping): ListPage
    {
        $base = clone $qb;
        $this->apply($qb, $query, $mapping);
        if (!$query->all()) {
            $qb->setFirstResult($query->offset())->setMaxResults($query->perPage);
        }
        $paginator = new Paginator($qb->getQuery(), fetchJoinCollection: true);
        $items = array_values(iterator_to_array($paginator));

        $facets = [];
        foreach ($query->facets as $field) {
            $facets[$field] = $this->facet(clone $base, $query, $mapping, $field);
        }

        return new ListPage($items, \count($paginator), $facets);
    }

    /**
     * @return list<array{value: string, count: int}>
     */
    private function facet(QueryBuilder $qb, ListQuery $query, ListMapping $mapping, string $field): array
    {
        $column = $mapping->columns[$field] ?? null;
        if (!\is_string($column)) {
            return [];
        }
        $this->filter($qb, $query->without($field), $mapping);
        $rows = $qb->select($column.' AS value', 'COUNT(DISTINCT '.$mapping->id.') AS n')
            ->groupBy($column)
            ->resetDQLPart('orderBy')
            ->getQuery()
            ->getArrayResult();

        $toApi = [];
        foreach ($mapping->enumValues[$field] ?? [] as $api => $database) {
            $toApi[self::key($database)] = (string) $api;
        }
        $counts = [];
        foreach ($rows as $row) {
            if (null === $row['value']) {
                continue;
            }
            $value = $toApi[self::key($row['value'])] ?? (string) $row['value'];
            $counts[$value] = ($counts[$value] ?? 0) + (int) $row['n'];
        }
        ksort($counts, \SORT_NATURAL);

        return array_map(static fn (string|int $value, int $count): array => ['value' => (string) $value, 'count' => $count], array_keys($counts), array_values($counts));
    }

    private static function key(mixed $value): string
    {
        return \is_bool($value) ? ($value ? '1' : '0') : (string) $value;
    }

    private function filter(QueryBuilder $qb, ListQuery $query, ListMapping $mapping): void
    {
        foreach ($query->filters as $field => $filter) {
            $column = $mapping->columns[$field] ?? null;
            if (null === $column) {
                throw new \LogicException(\sprintf('The list maps no column "%s": add it to its ListMapping.', $field));
            }
            $condition = $column instanceof \Closure
                ? $column($qb, $filter, $this->name())
                : $this->condition($qb, \is_array($column) ? $column : [$column], $filter, $mapping->enumValues[$field] ?? []);
            if (null !== $condition) {
                $qb->andWhere($condition);
            }
        }
        if (null !== $query->q && [] !== $mapping->search) {
            $qb->andWhere($this->condition($qb, $mapping->search, new TextFilter($query->q), []));
        }
    }

    /**
     * @param list<string>          $columns    any of them matches
     * @param array<string, scalar> $enumValues
     */
    private function condition(QueryBuilder $qb, array $columns, ListFilter $filter, array $enumValues): string
    {
        $any = static fn (array $conditions): string => 1 === \count($conditions) ? $conditions[0] : '('.implode(' OR ', $conditions).')';

        if ($filter instanceof TextFilter) {
            $name = $this->bind($qb, '%'.addcslashes(mb_strtolower($filter->text), '%_\\').'%');

            return $any(array_map(static fn (string $c): string => "LOWER({$c}) LIKE :{$name}", $columns));
        }
        if ($filter instanceof AnyOfFilter) {
            $name = $this->bind($qb, array_map(static fn (string $v) => $enumValues[$v] ?? $v, $filter->values));

            return $any(array_map(static fn (string $c): string => "{$c} IN (:{$name})", $columns));
        }
        if ($filter instanceof DateRangeFilter) {
            $parts = [];
            if (null !== $filter->from) {
                $from = $this->bind($qb, $filter->from, Types::DATETIME_IMMUTABLE);
                $parts[] = static fn (string $c): string => "{$c} >= :{$from}";
            }
            if (null !== $end = $filter->endExclusive()) {
                $to = $this->bind($qb, $end, Types::DATETIME_IMMUTABLE);
                $parts[] = static fn (string $c): string => "{$c} < :{$to}";
            }

            return $any(array_map(static fn (string $c): string => implode(' AND ', array_map(static fn (\Closure $p): string => $p($c), $parts)), $columns));
        }
        if ($filter instanceof NumberRangeFilter) {
            $parts = [];
            if (null !== $filter->min) {
                $min = $this->bind($qb, $filter->min);
                $parts[] = static fn (string $c): string => "{$c} >= :{$min}";
            }
            if (null !== $filter->max) {
                $max = $this->bind($qb, $filter->max);
                $parts[] = static fn (string $c): string => "{$c} <= :{$max}";
            }

            return $any(array_map(static fn (string $c): string => implode(' AND ', array_map(static fn (\Closure $p): string => $p($c), $parts)), $columns));
        }

        throw new \LogicException(\sprintf('No condition for %s.', $filter::class));
    }

    private function bind(QueryBuilder $qb, mixed $value, ?string $type = null): string
    {
        $name = $this->name();
        $qb->setParameter($name, $value, $type);

        return $name;
    }

    private function name(): string
    {
        return 'lq'.++$this->parameter;
    }
}
