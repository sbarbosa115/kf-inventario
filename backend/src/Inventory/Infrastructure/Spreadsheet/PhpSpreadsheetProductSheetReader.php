<?php

namespace App\Inventory\Infrastructure\Spreadsheet;

use App\Inventory\Application\Port\ProductSheetReader;
use App\Inventory\Domain\Error\InvalidSpreadsheet;
use PhpOffice\PhpSpreadsheet\IOFactory;

/**
 * Reads the active sheet as the legacy ProductService did (IOFactory::load, then toArray: formatted cell values), with
 * only the two Excel readers: the upload accepts xls and xlsx, and IOFactory would otherwise try every format it knows
 * (HTML, CSV, SYLK, Gnumeric, ODS…). A sheet narrower than the template's five columns (Code, Title, Detail, Quantity,
 * Price) is not the template, and is refused rather than read by position.
 */
final class PhpSpreadsheetProductSheetReader implements ProductSheetReader
{
    private const TEMPLATE_COLUMNS = 5;

    public function rows(string $path): array
    {
        try {
            $rows = IOFactory::load($path, 0, [IOFactory::READER_XLS, IOFactory::READER_XLSX])->getActiveSheet()->toArray();
        } catch (\Throwable $e) {
            throw new InvalidSpreadsheet($e);
        }

        $rows = array_values(array_map(array_values(...), $rows));
        if (\count($rows[0] ?? []) < self::TEMPLATE_COLUMNS) {
            throw new InvalidSpreadsheet();
        }

        return $rows;
    }
}
