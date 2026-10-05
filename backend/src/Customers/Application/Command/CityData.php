<?php

namespace App\Customers\Application\Command;

/**
 * A city an address names: the one with this id, else the one of its state with this name, else a new one.
 */
final readonly class CityData
{
    public function __construct(
        public ?int $id = null,
        public ?string $name = null,
        public ?StateData $state = null,
    ) {
    }
}
