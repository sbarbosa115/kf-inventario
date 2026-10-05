<?php

namespace App\Inventory\Infrastructure\Spreadsheet;

use App\Inventory\Application\Port\ProductSheetReader;
use App\Inventory\Domain\Error\InvalidSpreadsheet;
use PhpOffice\PhpSpreadsheet\IOFactory;

/**
 * Reads the active sheet as the legacy ProductService did (IOFactory::load, then toArray: formatted cell values).
 */
final class PhpSpreadsheetProductSheetReader implements ProductSheetReader
{
    public function rows(string $path): array
    {
        try {
            $rows = IOFactory::load($path)->getActiveSheet()->toArray();
        } catch (\Throwable $e) {
            throw new InvalidSpreadsheet($e);
        }

        return array_values(array_map(array_values(...), $rows));
    }
}
