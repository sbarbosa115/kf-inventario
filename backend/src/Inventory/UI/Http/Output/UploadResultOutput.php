<?php

namespace App\Inventory\UI\Http\Output;

/**
 * What a stock spreadsheet upload stored.
 */
final readonly class UploadResultOutput
{
    public function __construct(
        /** Rows stored (created or added to) */
        public int $stored,
    ) {
    }
}
