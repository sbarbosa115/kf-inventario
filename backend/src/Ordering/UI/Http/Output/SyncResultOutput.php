<?php

namespace App\Ordering\UI\Http\Output;

/**
 * What a pull of WooCommerce orders brought in.
 */
final readonly class SyncResultOutput
{
    public function __construct(
        public int $imported,
        /** Already imported (deleted ones included), or not placeable (unknown SKU, no lines) */
        public int $skipped,
    ) {
    }
}
