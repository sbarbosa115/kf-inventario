<?php

namespace App\Shared\UI\Http;

use App\Shared\Application\Query\AnyOfFilter;
use App\Shared\Application\Query\DateRangeFilter;
use App\Shared\Application\Query\FieldType;
use App\Shared\Application\Query\ListField;
use App\Shared\Application\Query\ListFilter;
use App\Shared\Application\Query\ListQuery;
use App\Shared\Application\Query\ListSchema;
use App\Shared\Application\Query\NumberRangeFilter;
use App\Shared\Application\Query\Sort;
use App\Shared\Application\Query\TextFilter;
use Symfony\Component\HttpFoundation\Request;

/**
 * Reads the list-query contract from a query string (docs/pdr/prd-shops-settings.md, "List query contract"):
 *
 *     page=2  per_page=25  sort=-created_at  q=text  facets=status,source
 *     filter[code]=W00   filter[status][]=1   filter[created_at][from]=2026-10-01   filter[total][min]=100
 *
 * against the endpoint's ListSchema. Every mistake is reported at once, as a 422 `validation_failed` whose
 * violations name `page`, `per_page`, `sort`, `facets` or `filter.<field>`. Parameters that are not part of the
 * contract (warehouse_id, status…) are the endpoint's own and are left alone.
 */
final class ListQueryParser
{
    private const DATE = '/^\d{4}-\d{2}-\d{2}$/';
    private const DECIMAL = '/^-?\d{1,12}(\.\d{1,4})?$/';

    public function parse(Request $request, ListSchema $schema): ListQuery
    {
        $query = $request->query->all();
        $violations = [];

        $page = self::integer($query['page'] ?? null, 1);
        if (null === $page || $page < 1) {
            $violations[] = ['field' => 'page', 'message' => 'This value should be a page number (1 or more).'];
            $page = 1;
        }

        $perPage = self::integer($query['per_page'] ?? null, $schema->defaultPerPage);
        if (null === $perPage || $perPage > $schema->maxPerPage || $perPage < 0 || (0 === $perPage && !$schema->allowAll)) {
            $violations[] = ['field' => 'per_page', 'message' => 'This value should be between 1 and %max%.', 'parameters' => ['%max%' => $schema->maxPerPage]];
            $perPage = $schema->defaultPerPage;
        }
        if (0 === $perPage) {
            $page = 1;
        }

        $sort = null;
        $sortParam = $query['sort'] ?? null;
        if (\is_string($sortParam) && '' !== trim($sortParam)) {
            $sort = Sort::parse(trim($sortParam));
            if (!\in_array($sort->field, $schema->sorts, true)) {
                $violations[] = ['field' => 'sort', 'message' => 'This list cannot be sorted that way.'];
                $sort = null;
            }
        } elseif (null !== $sortParam && !\is_string($sortParam)) {
            $violations[] = ['field' => 'sort', 'message' => 'This list cannot be sorted that way.'];
        }
        $sort ??= null === $schema->defaultSort ? null : Sort::parse($schema->defaultSort);

        $q = $query['q'] ?? null;
        $q = $schema->searchable && \is_string($q) && '' !== trim($q) ? trim($q) : null;

        $filters = [];
        $given = $query['filter'] ?? [];
        if (!\is_array($given)) {
            $given = [];
        }
        foreach ($given as $name => $value) {
            $name = (string) $name;
            $field = $schema->field($name);
            if (null === $field) {
                $violations[] = ['field' => 'filter.'.$name, 'message' => 'This list cannot be filtered by this column.'];
                continue;
            }
            try {
                $filter = self::filter($field, $value);
            } catch (\InvalidArgumentException $e) {
                $violations[] = ['field' => 'filter.'.$name, 'message' => $e->getMessage()];
                continue;
            }
            if (null !== $filter) {
                $filters[$name] = $filter;
            }
        }

        $facets = [];
        $facetParam = $query['facets'] ?? null;
        if (\is_string($facetParam) && '' !== trim($facetParam)) {
            foreach (array_filter(array_map('trim', explode(',', $facetParam))) as $name) {
                if (FieldType::Enum !== $schema->field($name)?->type) {
                    $violations[] = ['field' => 'facets', 'message' => 'Only the columns with a list of values have counts.'];
                    break;
                }
                $facets[] = $name;
            }
        }

        if ([] !== $violations) {
            throw new ApiValidationException($violations);
        }

        return new ListQuery($page, $perPage, $sort, $q, $filters, array_values(array_unique($facets)));
    }

    private static function integer(mixed $value, int $default): ?int
    {
        if (null === $value || '' === $value) {
            return $default;
        }

        return \is_string($value) && 1 === preg_match('/^\d{1,9}$/', $value) ? (int) $value : null;
    }

    /**
     * @throws \InvalidArgumentException with the violation's message
     */
    private static function filter(ListField $field, mixed $value): ?ListFilter
    {
        return match ($field->type) {
            FieldType::Text => self::text($value),
            FieldType::Enum => self::anyOf($field, $value),
            FieldType::Date => self::dateRange($value),
            FieldType::Number => self::numberRange($value),
        };
    }

    private static function text(mixed $value): ?TextFilter
    {
        if (!\is_string($value)) {
            throw new \InvalidArgumentException('This filter is one text.');
        }

        return '' === trim($value) ? null : new TextFilter(trim($value));
    }

    private static function anyOf(ListField $field, mixed $value): ?AnyOfFilter
    {
        $values = \is_string($value) ? [$value] : $value;
        if (!\is_array($values) || !array_is_list($values)) {
            throw new \InvalidArgumentException('This filter is a list of values.');
        }
        $values = array_values(array_unique(array_filter(array_map(static fn ($v): string => \is_scalar($v) ? trim((string) $v) : "\0", $values), static fn (string $v): bool => '' !== $v)));
        foreach ($values as $v) {
            if (!$field->accepts($v)) {
                throw new \InvalidArgumentException('This column has no such value.');
            }
        }

        return [] === $values ? null : new AnyOfFilter($values);
    }

    private static function dateRange(mixed $value): ?DateRangeFilter
    {
        if (!\is_array($value) || [] !== array_diff(array_keys($value), ['from', 'to'])) {
            throw new \InvalidArgumentException('This filter is a range of days (from, to).');
        }
        $from = self::day($value['from'] ?? null);
        $to = self::day($value['to'] ?? null);

        return null === $from && null === $to ? null : new DateRangeFilter($from, $to);
    }

    private static function day(mixed $value): ?\DateTimeImmutable
    {
        if (null === $value || '' === $value) {
            return null;
        }
        $day = \is_string($value) && 1 === preg_match(self::DATE, $value)
            ? \DateTimeImmutable::createFromFormat('!Y-m-d', $value, new \DateTimeZone('America/Bogota'))
            : false;
        if (false === $day || $day->format('Y-m-d') !== $value) {
            throw new \InvalidArgumentException('A day is written YYYY-MM-DD.');
        }

        return $day;
    }

    private static function numberRange(mixed $value): ?NumberRangeFilter
    {
        if (!\is_array($value) || [] !== array_diff(array_keys($value), ['min', 'max'])) {
            throw new \InvalidArgumentException('This filter is a range (min, max).');
        }
        $min = self::decimal($value['min'] ?? null);
        $max = self::decimal($value['max'] ?? null);

        return null === $min && null === $max ? null : new NumberRangeFilter($min, $max);
    }

    private static function decimal(mixed $value): ?string
    {
        if (null === $value || '' === $value) {
            return null;
        }
        if (!\is_string($value) || 1 !== preg_match(self::DECIMAL, $value)) {
            throw new \InvalidArgumentException('This value should be a number.');
        }

        return $value;
    }
}
