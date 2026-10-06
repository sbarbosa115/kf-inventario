<?php

namespace App\Ordering\Application\Port;

use App\Ordering\Domain\Model\Order;

/**
 * The order's files, rendered as the legacy app rendered them (Twig + Dompdf on letter paper, PhpSpreadsheet).
 */
interface OrderDocuments
{
    /**
     * The order as a PDF (templates/pdf/order.html.twig): what the printer gets.
     */
    public function pdf(Order $order): string;

    /**
     * What is left to ship, as a PDF (templates/pdf/order-remaining.html.twig).
     */
    public function remainingPdf(Order $order): string;

    /**
     * The order's products as an .xls sheet: date, product code, quantity.
     */
    public function spreadsheet(Order $order): string;
}
