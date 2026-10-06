<?php

namespace App\Shared\Application\Port;

/**
 * Turns an HTML page into a PDF on letter paper (the legacy PdfHandlerService). The HTML is the caller's: each context
 * renders its own Twig template (an order, an invoice) and hands the result here.
 */
interface PdfRenderer
{
    /**
     * @return string the PDF's bytes
     */
    public function render(string $html): string;
}
