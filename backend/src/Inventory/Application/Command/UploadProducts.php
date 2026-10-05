<?php

namespace App\Inventory\Application\Command;

/**
 * A filled-in stock spreadsheet (already checked to be xls/xlsx) loaded into a warehouse.
 */
final readonly class UploadProducts
{
    public function __construct(
        public string $path,
        public int $warehouseId,
    ) {
    }
}
