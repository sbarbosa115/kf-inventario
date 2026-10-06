<?php

namespace App\Shared\UI\Http;

use App\Shared\Application\Query\AnyOfFilter;
use App\Shared\Application\Query\DateRangeFilter;
use App\Shared\Application\Query\ListFilter;
use App\Shared\Application\Query\ListPage;
use App\Shared\Application\Query\ListQuery;
use App\Shared\Application\Query\NumberRangeFilter;
use App\Shared\Application\Query\TextFilter;

/**
 * The list-query contract over rows already in memory: the walking skeleton of shops-settings' item 0 (correct, but
 * it loads every row). Item 1 (list-api) replaces each use with ListQueryApplier in SQL. Same semantics: text
 * contains (case-insensitive), any-of for enums (a row may hold several values: a user's roles), Bogota days for
 * dates, both ends included, sort by the field then the id, facets over every filter but their own.
 */
final class InMemoryList
{
    /**
     * @template T
     *
     * @param list<T>                                                                                  $rows
     * @param array<string, \Closure(T): (string|int|float|bool|\DateTimeInterface|list<string>|null)> $fields each column's value(s); enums as their API values
     * @param list<\Closure(T): ?string>                                                               $search the texts `q` looks in
     * @param \Closure(T): int                                                                         $id
     *
     * @return ListPage<T>
     */
    public static function page(array $rows, ListQuery $query, array $fields, array $search, \Closure $id): ListPage
    {
        $kept = self::filter($rows, $query, $fields, $search);

        if (null !== $query->sort && isset($fields[$query->sort->field])) {
            $value = $fields[$query->sort->field];
            $direction = $query->sort->descending ? -1 : 1;
            usort($kept, static function ($a, $b) use ($value, $id, $direction): int {
                $order = self::compare($value($a), $value($b));

                return $direction * (0 !== $order ? $order : $id($a) <=> $id($b));
            });
        }

        $facets = [];
        foreach ($query->facets as $field) {
            $counts = [];
            foreach (self::filter($rows, $query->without($field), $fields, $search) as $row) {
                $values = isset($fields[$field]) ? $fields[$field]($row) : null;
                foreach (\is_array($values) ? $values : [$values] as $v) {
                    if (null !== $v && '' !== $v) {
                        $key = \is_bool($v) ? ($v ? '1' : '0') : (string) $v;
                        $counts[$key] = ($counts[$key] ?? 0) + 1;
                    }
                }
            }
            ksort($counts, \SORT_NATURAL);
            $facets[$field] = array_map(static fn (string|int $v, int $n): array => ['value' => (string) $v, 'count' => $n], array_keys($counts), array_values($counts));
        }

        $page = $query->all() ? $kept : \array_slice($kept, $query->offset(), $query->perPage);

        return new ListPage($page, \count($kept), $facets);
    }

    /**
     * @template T
     *
     * @param list<T>                           $rows
     * @param array<string, \Closure(T): mixed> $fields
     * @param list<\Closure(T): ?string>        $search
     *
     * @return list<T>
     */
    private static function filter(array $rows, ListQuery $query, array $fields, array $search): array
    {
        $needle = null === $query->q ? null : mb_strtolower($query->q);

        return array_values(array_filter($rows, static function ($row) use ($query, $fields, $search, $needle): bool {
            foreach ($query->filters as $field => $filter) {
                if (!isset($fields[$field]) || !self::matches($fields[$field]($row), $filter)) {
                    return false;
                }
            }
            if (null !== $needle) {
                foreach ($search as $text) {
                    if (str_contains(mb_strtolower((string) $text($row)), $needle)) {
                        return true;
                    }
                }

                return false;
            }

            return true;
        }));
    }

    private static function matches(mixed $value, ListFilter $filter): bool
    {
        if ($filter instanceof TextFilter) {
            return str_contains(mb_strtolower(\is_array($value) ? implode(' ', $value) : (string) $value), mb_strtolower($filter->text));
        }
        if ($filter instanceof AnyOfFilter) {
            $values = array_map(static fn ($v): string => \is_bool($v) ? ($v ? '1' : '0') : (string) $v, \is_array($value) ? $value : [$value]);

            return [] !== array_intersect($values, $filter->values);
        }
        if ($filter instanceof DateRangeFilter) {
            if (!$value instanceof \DateTimeInterface) {
                return false;
            }
            $day = \DateTimeImmutable::createFromInterface($value)->setTimezone(new \DateTimeZone('America/Bogota'))->format('Y-m-d');

            return (null === $filter->from || $day >= $filter->from->format('Y-m-d')) && (null === $filter->to || $day <= $filter->to->format('Y-m-d'));
        }
        if ($filter instanceof NumberRangeFilter) {
            if (null === $value || '' === $value || \is_array($value)) {
                return false;
            }
            $number = (float) $value;

            return (null === $filter->min || $number >= (float) $filter->min) && (null === $filter->max || $number <= (float) $filter->max);
        }

        return false;
    }

    private static function compare(mixed $a, mixed $b): int
    {
        if ($a instanceof \DateTimeInterface || $b instanceof \DateTimeInterface) {
            return ($a?->getTimestamp() ?? \PHP_INT_MIN) <=> ($b?->getTimestamp() ?? \PHP_INT_MIN);
        }
        if (\is_string($a) || \is_string($b)) {
            return strnatcasecmp((string) (\is_array($a) ? implode(' ', $a) : $a), (string) (\is_array($b) ? implode(' ', $b) : $b));
        }

        return $a <=> $b;
    }
}
