<?php

namespace App\Customers\Application\Command;

/**
 * A country an address names: the one with this id, else the one with this name or code, else a new one.
 */
final readonly class CountryData
{
    public function __construct(
        public ?int $id = null,
        public ?string $name = null,
        public ?string $code = null,
    ) {
    }
}
