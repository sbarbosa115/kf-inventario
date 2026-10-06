<?php

namespace App\Shared\UI\Http\Output;

use App\Shared\Application\Query\ListPage;
use App\Shared\Application\Query\ListQuery;

/**
 * Every list endpoint's answer (docs/pdr/prd-shops-settings.md, "List query contract"), described for OpenAPI by
 * #[ApiResponse(XOutput::class, page: true)]:
 *
 *     {"items": [...], "total": 1240, "page": 1, "per_page": 25, "facets": {"status": [{"value": "1", "count": 12}]}}
 *
 * `facets` only when asked for; `totals` only on the endpoints that add figures over every filtered row (stock).
 */
final class PageOutput
{
    /**
     * @template T
     *
     * @param ListPage<T>         $page
     * @param \Closure(T): object $present the row's Output DTO
     *
     * @return array<string, mixed>
     */
    public static function of(ListPage $page, ListQuery $query, \Closure $present, ?object $totals = null): array
    {
        $answer = [
            'items' => array_map($present, $page->items),
            'total' => $page->total,
            'page' => $query->page,
            'per_page' => $query->perPage,
        ];
        if ([] !== $query->facets) {
            $answer['facets'] = array_map(
                static fn (array $counts): array => array_map(static fn (array $c): FacetCountOutput => new FacetCountOutput($c['value'], $c['count']), $counts),
                $page->facets,
            );
        }
        if (null !== $totals) {
            $answer['totals'] = $totals;
        }

        return $answer;
    }
}
