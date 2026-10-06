<?php

namespace App\Ordering\UI\Http\Controller;

use App\Ordering\Application\Port\OrderDocuments;
use App\Ordering\Application\Query\Orders;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * The order's files, with the legacy headers: the SPA opens them in a new tab (the session cookie signs the request).
 */
final class OrderDocumentController extends AbstractController
{
    public function __construct(
        private readonly Orders $orders,
        private readonly OrderDocuments $documents,
    ) {
    }

    /**
     * The order as a PDF (the printer's).
     */
    #[Route('/api/v1/orders/{id}/pdf', name: 'api_orders_pdf', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CAN_READ_ORDERS')]
    public function pdf(int $id): Response
    {
        return new Response($this->documents->pdf($this->orders->get($id)), 200, ['Content-Type' => 'application/pdf']);
    }

    /**
     * What is left to ship, as a PDF.
     */
    #[Route('/api/v1/orders/{id}/remaining-pdf', name: 'api_orders_remaining_pdf', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CAN_READ_ORDERS')]
    public function remainingPdf(int $id): Response
    {
        return new Response($this->documents->remainingPdf($this->orders->get($id)), 200, ['Content-Type' => 'application/pdf']);
    }

    /**
     * The order's products as a spreadsheet (date, product code, quantity). As before: any signed-in user, and the
     * file is named after product.xls.filename and the order code.
     */
    #[Route('/api/v1/orders/{id}/xls', name: 'api_orders_xls', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    public function xls(int $id, TranslatorInterface $translator): Response
    {
        $order = $this->orders->get($id);
        // The code is typed (or the shop's): a quote, backslash or control character in it would end the filename or
        // the header early, so each becomes "_"; any other code gives the legacy name unchanged.
        $code = preg_replace('/["\\\\\x00-\x1F\x7F]/', '_', (string) $order->getCode());
        $filename = "{$translator->trans('product.xls.filename')}-{$code}";

        return new Response($this->documents->spreadsheet($order), 200, [
            'Content-Type' => 'application/vnd.ms-excel',
            'Content-Disposition' => 'attachment;filename="'.$filename.'.xls"',
            'Cache-Control' => 'max-age=0',
        ]);
    }
}
