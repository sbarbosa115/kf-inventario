<?php

namespace App\Ordering\UI\Http\Output;

/**
 * What a pull of WooCommerce orders brought in.
 */
final readonly class SyncResultOutput
{
    public function __construct(
        public int $imported,
        /** Already imported, or from a warehouse without credentials */
        public int $skipped,
    ) {
    }
}
