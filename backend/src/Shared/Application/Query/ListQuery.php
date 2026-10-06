<?php

namespace App\Shared\Application\Query;

/**
 * What a list endpoint was asked for, checked against its ListSchema (Shared\UI\Http\ListQueryParser): the page
 * (1-based; perPage 0 = every row), the sort, the free text `q`, one filter per column, and the enum columns whose
 * counts (facets) to answer.
 */
final readonly class ListQuery
{
    /**
     * @param array<string, ListFilter> $filters
     * @param list<string>              $facets
     */
    public function __construct(
        public int $page,
        public int $perPage,
        public ?Sort $sort,
        public ?string $q,
        public array $filters,
        public array $facets,
    ) {
    }

    public function all(): bool
    {
        return 0 === $this->perPage;
    }

    public function offset(): int
    {
        return $this->all() ? 0 : ($this->page - 1) * $this->perPage;
    }

    /** The same query without one column's filter: what that column's facet counts over. */
    public function without(string $field): self
    {
        $filters = $this->filters;
        unset($filters[$field]);

        return new self($this->page, $this->perPage, $this->sort, $this->q, $filters, $this->facets);
    }
}
