<?php

namespace App\Invoicing\UI\Http\Controller;

use App\Shared\UI\Http\ApiException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * The contract of this context's endpoints (docs/pdr/prd-restructure.md, the route map): each answers 501
 * not_implemented until the item named on it builds it, test-first, keeping the route, its role and its response.
 */
final class InvoiceDocumentController extends AbstractController
{
    /**
     * The invoice as a PDF. (item 5).
     */
    #[Route('/api/v1/invoices/{id}/pdf', name: 'api_invoices_pdf', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CAN_READ_INVOICES')]
    public function pdf(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }
}
