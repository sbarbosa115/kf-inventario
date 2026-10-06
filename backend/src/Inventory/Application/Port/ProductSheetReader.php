<?php

namespace App\Inventory\Application\Port;

use App\Inventory\Domain\Error\InvalidSpreadsheet;

/**
 * Reads an uploaded stock spreadsheet (the template's columns: code, title, detail, quantity, price; the first row is
 * the header).
 */
interface ProductSheetReader
{
    /**
     * The active sheet's rows, as the cells show them, the header included.
     *
     * @return list<list<mixed>>
     *
     * @throws InvalidSpreadsheet when the file cannot be read as a spreadsheet
     */
    public function rows(string $path): array;
}
