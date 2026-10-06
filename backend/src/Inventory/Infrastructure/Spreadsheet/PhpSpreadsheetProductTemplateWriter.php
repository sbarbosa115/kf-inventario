<?php

namespace App\Inventory\Infrastructure\Spreadsheet;

use App\Inventory\Application\Port\ProductTemplateWriter;
use App\Shared\Infrastructure\Spreadsheet\SafeCell;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xls;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * The legacy ProductController::uploadProductsTemplate's sheet: the translated header in A1:E1 (product.template.*),
 * then code, title, detail, 0, 0 per product, written as xls (typed text through SafeCell: never a formula).
 */
final class PhpSpreadsheetProductTemplateWriter implements ProductTemplateWriter
{
    public function __construct(private readonly TranslatorInterface $translator)
    {
    }

    public function write(array $products): string
    {
        $template = new Spreadsheet();
        $sheet = $template->getActiveSheet();
        foreach (['A' => 'code', 'B' => 'title', 'C' => 'detail', 'D' => 'quantity', 'E' => 'price'] as $column => $key) {
            $sheet->setCellValue("{$column}1", $this->translator->trans("product.template.{$key}"));
        }
        foreach ($products as $index => $product) {
            $row = $index + 2;
            SafeCell::set($sheet, "A{$row}", $product->getCode());
            SafeCell::set($sheet, "B{$row}", $product->getTitle());
            SafeCell::set($sheet, "C{$row}", $product->getDetail());
            $sheet->setCellValue("D{$row}", 0);
            $sheet->setCellValue("E{$row}", 0);
        }

        $stream = fopen('php://memory', 'r+');
        \assert(false !== $stream);
        (new Xls($template))->save($stream);
        rewind($stream);
        $bytes = (string) stream_get_contents($stream);
        fclose($stream);

        return $bytes;
    }
}
