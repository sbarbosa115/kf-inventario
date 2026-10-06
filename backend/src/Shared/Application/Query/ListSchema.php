<?php

namespace App\Shared\Application\Query;

/**
 * A list endpoint's allow-list: the columns it filters (and how), the sorts it accepts, its default sort, its page
 * sizes, and whether `per_page=0` (every row) is allowed — only for the stock pickers (Decisions 12).
 */
final readonly class ListSchema
{
    /**
     * @param array<string, ListField> $fields
     * @param list<string>             $sorts       the fields `sort` accepts (each also as -field)
     * @param string|null              $defaultSort `field` or `-field`
     */
    public function __construct(
        public array $fields,
        public array $sorts,
        public ?string $defaultSort = null,
        public bool $searchable = true,
        public int $defaultPerPage = 25,
        public int $maxPerPage = 100,
        public bool $allowAll = false,
    ) {
    }

    public function field(string $name): ?ListField
    {
        return $this->fields[$name] ?? null;
    }
}
