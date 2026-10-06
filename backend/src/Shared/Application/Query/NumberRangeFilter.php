<?php

namespace App\Shared\Application\Query;

/** Between min and max, both included, as decimal strings (money stays exact); either end may be open. */
final readonly class NumberRangeFilter implements ListFilter
{
    public function __construct(
        public ?string $min,
        public ?string $max,
    ) {
    }
}
