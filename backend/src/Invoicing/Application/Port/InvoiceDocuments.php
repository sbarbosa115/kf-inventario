<?php

namespace App\Invoicing\Application\Port;

use App\Invoicing\Domain\Model\Invoice;

/**
 * The invoice's file, rendered as the legacy app rendered it (Twig + Dompdf on letter paper).
 */
interface InvoiceDocuments
{
    /**
     * The invoice as a PDF (templates/pdf/invoice.html.twig), with the logo from public/images when there is one.
     */
    public function pdf(Invoice $invoice): string;
}
