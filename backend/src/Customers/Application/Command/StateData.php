<?php

namespace App\Customers\Application\Command;

/**
 * A state an address names: the one with this id, else the one of its country with this name or code, else a new one.
 */
final readonly class StateData
{
    public function __construct(
        public ?int $id = null,
        public ?string $name = null,
        public ?string $code = null,
        public ?CountryData $country = null,
    ) {
    }
}
