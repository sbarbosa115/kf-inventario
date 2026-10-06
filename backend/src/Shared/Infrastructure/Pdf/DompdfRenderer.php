<?php

namespace App\Shared\Infrastructure\Pdf;

use App\Shared\Application\Port\PdfRenderer;
use Dompdf\Dompdf;

/**
 * Dompdf with exactly the legacy PdfHandlerService's settings: its default options, letter paper (portrait).
 */
final class DompdfRenderer implements PdfRenderer
{
    public function render(string $html): string
    {
        $pdf = new Dompdf();
        $pdf->loadHtml($html);
        $pdf->setPaper('letter');
        $pdf->render();

        return (string) $pdf->output();
    }
}
