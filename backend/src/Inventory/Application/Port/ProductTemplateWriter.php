<?php

namespace App\Inventory\Application\Port;

use App\Inventory\Domain\Model\Product;

/**
 * Writes the stock spreadsheet people fill in and upload: the header, then one row per product with its code, title
 * and detail, and the quantity and price at 0.
 */
interface ProductTemplateWriter
{
    /**
     * @param list<Product> $products
     *
     * @return string the xls file's bytes
     */
    public function write(array $products): string;
}
