<?php

namespace App\Inventory\UI\Http\Output;

/**
 * A warehouse, named where another record points at it.
 */
final readonly class WarehouseRefOutput
{
    public function __construct(
        public int $id,
        public string $name,
    ) {
    }
}
