<?php

namespace App\Customers\UI\Http\Output;

/**
 * A state and its cities, in the locations tree.
 */
final readonly class StateOutput
{
    /**
     * @param list<CityOutput> $cities
     */
    public function __construct(
        public int $id,
        public string $name,
        public ?string $code,
        public array $cities,
    ) {
    }
}
