<?php

namespace App\Customers\UI\Http\Output;

/**
 * A country and its states, in the locations tree the address form picks from.
 */
final readonly class CountryOutput
{
    /**
     * @param list<StateOutput> $states
     */
    public function __construct(
        public int $id,
        public string $name,
        public ?string $code,
        public array $states,
    ) {
    }
}
