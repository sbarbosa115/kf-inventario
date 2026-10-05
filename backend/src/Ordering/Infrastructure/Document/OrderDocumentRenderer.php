<?php

namespace App\Ordering\Infrastructure\Document;

use App\Ordering\Application\Port\OrderDocuments;
use App\Ordering\Domain\Model\Order;
use App\Shared\Application\Port\PdfRenderer;
use App\Shared\Infrastructure\Spreadsheet\SafeCell;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xls;
use Symfony\Contracts\Translation\TranslatorInterface;
use Twig\Environment;

/**
 * The order's files as the legacy OrderController made them: the Twig templates (copied to templates/pdf/) turned
 * into a PDF by Shared's PdfRenderer (Dompdf, letter paper), and the .xls sheet with its translated headers.
 */
final class OrderDocumentRenderer implements OrderDocuments
{
    public function __construct(
        private readonly Environment $twig,
        private readonly TranslatorInterface $translator,
        private readonly PdfRenderer $pdf,
    ) {
    }

    public function pdf(Order $order): string
    {
        return $this->pdf->render($this->twig->render('pdf/order.html.twig', ['order' => $order]));
    }

    public function remainingPdf(Order $order): string
    {
        return $this->pdf->render($this->twig->render('pdf/order-remaining.html.twig', ['order' => $order]));
    }

    public function spreadsheet(Order $order): string
    {
        $sheet = new Spreadsheet();
        $active = $sheet->getActiveSheet();
        $active->setCellValue('A1', $this->translator->trans('order.xls.date'));
        $active->setCellValue('B1', $this->translator->trans('order.xls.productCode'));
        $active->setCellValue('C1', $this->translator->trans('order.xls.quantity'));

        $row = 2;
        foreach ($order->getOrderProducts() as $line) {
            $active->setCellValue("A{$row}", $order->getCreatedAt()?->format('Y-m-d'));
            SafeCell::set($active, "B{$row}", $line->getProduct()?->getCode());
            $active->setCellValue("C{$row}", $line->getQuantity());
            ++$row;
        }

        $stream = fopen('php://memory', 'r+');
        if (false === $stream) {
            throw new \RuntimeException('Cannot open a memory stream for the spreadsheet.');
        }
        (new Xls($sheet))->save($stream);
        rewind($stream);
        $bytes = (string) stream_get_contents($stream);
        fclose($stream);

        return $bytes;
    }
}
