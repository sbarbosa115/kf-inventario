<?php

namespace App\Invoicing\UI\Http\Controller;

use App\Invoicing\Application\Port\InvoiceDocuments;
use App\Invoicing\Application\Query\Invoices;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * The invoice's file, with the legacy headers: the SPA opens it in a new tab (the session cookie signs the request).
 */
final class InvoiceDocumentController extends AbstractController
{
    public function __construct(
        private readonly Invoices $invoices,
        private readonly InvoiceDocuments $documents,
    ) {
    }

    /**
     * The invoice as a PDF. 404 invoice_not_found.
     */
    #[Route('/api/v1/invoices/{id}/pdf', name: 'api_invoices_pdf', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CAN_READ_INVOICES')]
    public function pdf(int $id): Response
    {
        return new Response($this->documents->pdf($this->invoices->get($id)), 200, ['Content-Type' => 'application/pdf']);
    }
}
