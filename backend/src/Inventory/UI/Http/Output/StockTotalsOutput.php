<?php

namespace App\Inventory\UI\Http\Output;

/** The figures of every stock row the filters keep (not only the page): the Products KPIs. */
final readonly class StockTotalsOutput
{
    public function __construct(
        /** The sum of the quantities */
        public int $units,
        /** The sum of quantity × price, in dollars */
        public float $value,
    ) {
    }
}
