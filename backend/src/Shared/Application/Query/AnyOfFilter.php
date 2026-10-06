<?php

namespace App\Shared\Application\Query;

/** The column holds any of these values (an enum column). */
final readonly class AnyOfFilter implements ListFilter
{
    /**
     * @param non-empty-list<string> $values
     */
    public function __construct(public array $values)
    {
    }
}
