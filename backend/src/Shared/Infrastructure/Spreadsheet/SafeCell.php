<?php

namespace App\Shared\Infrastructure\Spreadsheet;

use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Writes a value someone typed (a product code, title, detail) into a sheet the app hands out. setCellValue() makes
 * any text starting with "=" a formula, so a product named =HYPERLINK(…) would be a live formula in the downloaded
 * file (spreadsheet formula injection); that text is written as text instead, exactly as typed. Everything else is
 * written as setCellValue() writes it (a numeric code stays a number, as before).
 */
final class SafeCell
{
    public static function set(Worksheet $sheet, string $coordinate, mixed $value): void
    {
        if (\is_string($value) && str_starts_with($value, '=')) {
            $sheet->setCellValueExplicit($coordinate, $value, DataType::TYPE_STRING);

            return;
        }

        $sheet->setCellValue($coordinate, $value);
    }
}
