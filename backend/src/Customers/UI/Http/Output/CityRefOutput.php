<?php

namespace App\Customers\UI\Http\Output;

/**
 * A city and its state, where an address names it.
 */
final readonly class CityRefOutput
{
    public function __construct(
        public int $id,
        public string $name,
        public StateRefOutput $state,
    ) {
    }
}
