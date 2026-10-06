<?php

namespace App\Shared\Infrastructure\Persistence;

use App\Shared\Application\Query\ListFilter;
use Doctrine\ORM\QueryBuilder;

/**
 * How a list endpoint's columns map onto its Doctrine query: each field's DQL expression (several: any of them
 * matches; a closure: a condition of its own, e.g. `source` = phone | web | shop:<id>), the search columns of `q`,
 * the sort expressions (the field's expression by default), and the database value of each enum value when they
 * differ (`yes` → true).
 */
final readonly class ListMapping
{
    /**
     * @param string                                                                                 $id         the root's id expression (count, tie-break)
     * @param array<string, string|list<string>|\Closure(QueryBuilder, ListFilter, string): ?string> $columns
     * @param list<string>                                                                           $search
     * @param array<string, string>                                                                  $sorts
     * @param array<string, array<string, scalar>>                                                   $enumValues field → [api value → database value]
     */
    public function __construct(
        public string $id,
        public array $columns,
        public array $search = [],
        public array $sorts = [],
        public array $enumValues = [],
    ) {
    }

    public function sortExpression(string $field): ?string
    {
        $column = $this->sorts[$field] ?? $this->columns[$field] ?? null;

        return \is_string($column) ? $column : null;
    }
}
