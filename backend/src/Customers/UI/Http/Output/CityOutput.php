<?php

namespace App\Customers\UI\Http\Output;

/**
 * A city in the locations tree.
 */
final readonly class CityOutput
{
    public function __construct(
        public int $id,
        public string $name,
    ) {
    }
}
