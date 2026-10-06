<?php

namespace App\Shared\UI\Http\Output;

/** How many rows of a list hold one value of an enum column (over every filter but that column's). */
final readonly class FacetCountOutput
{
    public function __construct(
        public string $value,
        public int $count,
    ) {
    }
}
