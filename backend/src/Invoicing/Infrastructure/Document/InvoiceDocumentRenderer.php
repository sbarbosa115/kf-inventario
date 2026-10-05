<?php

namespace App\Invoicing\Infrastructure\Document;

use App\Invoicing\Application\Port\InvoiceDocuments;
use App\Invoicing\Domain\Model\Invoice;
use App\Shared\Application\Port\PdfRenderer;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Twig\Environment;

/**
 * The invoice PDF as the legacy InvoiceController made it: the Twig template (copied to templates/pdf/) with the
 * payment method's label and the logo found in public/images, turned into a PDF by Shared's PdfRenderer.
 */
final class InvoiceDocumentRenderer implements InvoiceDocuments
{
    private const PAYMENT_LABELS = [
        'credit_counted' => 'Credit - counted',
        'credit_card' => 'Credit card - Paypal',
    ];

    private const LOGOS = [
        'logo.png' => 'image/png',
        'logo.jpg' => 'image/jpeg',
        'logo.jpeg' => 'image/jpeg',
        'logo.gif' => 'image/gif',
    ];

    public function __construct(
        private readonly Environment $twig,
        private readonly PdfRenderer $pdf,
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {
    }

    public function pdf(Invoice $invoice): string
    {
        $method = $invoice->getPaymentMethod();

        return $this->pdf->render($this->twig->render('pdf/invoice.html.twig', [
            'invoice' => $invoice,
            'paymentMethodLabel' => $method ? (self::PAYMENT_LABELS[$method] ?? $method) : '-',
            'logo_data' => $this->logo(),
        ]));
    }

    private function logo(): ?string
    {
        foreach (self::LOGOS as $file => $mime) {
            $path = $this->projectDir.'/public/images/'.$file;
            if (file_exists($path)) {
                return 'data:'.$mime.';base64,'.base64_encode((string) file_get_contents($path));
            }
        }

        return null;
    }
}
