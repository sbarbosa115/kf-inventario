<?php

namespace App\Customers\UI\Http\Output;

/**
 * A state and its country, where an address names it.
 */
final readonly class StateRefOutput
{
    public function __construct(
        public int $id,
        public string $name,
        public ?string $code,
        public CountryRefOutput $country,
    ) {
    }
}
