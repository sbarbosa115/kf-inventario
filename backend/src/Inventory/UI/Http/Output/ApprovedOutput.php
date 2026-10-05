<?php

namespace App\Inventory\UI\Http\Output;

/**
 * How many incoming stock rows were approved.
 */
final readonly class ApprovedOutput
{
    public function __construct(
        public int $approved,
    ) {
    }
}
