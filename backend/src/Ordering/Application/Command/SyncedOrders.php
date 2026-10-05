<?php

namespace App\Ordering\Application\Command;

/**
 * What a pull of the shops' orders did.
 */
final readonly class SyncedOrders
{
    public function __construct(
        /** Orders placed */
        public int $imported,
        /** Orders the shops sent that were not placed: already imported, or not placeable (logged) */
        public int $skipped,
    ) {
    }
}
