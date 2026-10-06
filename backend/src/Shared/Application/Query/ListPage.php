<?php

namespace App\Shared\Application\Query;

/**
 * One page of a list: its rows, how many rows the filters keep in all, and the facet counts asked for
 * (field → [{value, count}], by value).
 *
 * @template T
 */
final readonly class ListPage
{
    /**
     * @param list<T>                                               $items
     * @param array<string, list<array{value: string, count: int}>> $facets
     */
    public function __construct(
        public array $items,
        public int $total,
        public array $facets = [],
    ) {
    }
}
