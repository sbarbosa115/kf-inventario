<?php

namespace App\Customers\UI\Http\Output;

/**
 * A country, where an address names it.
 */
final readonly class CountryRefOutput
{
    public function __construct(
        public int $id,
        public string $name,
        public ?string $code,
    ) {
    }
}
