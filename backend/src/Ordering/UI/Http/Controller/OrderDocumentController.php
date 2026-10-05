<?php

namespace App\Ordering\UI\Http\Controller;

use App\Shared\UI\Http\ApiException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * The contract of this context's endpoints (docs/pdr/prd-restructure.md, the route map): each answers 501
 * not_implemented until the item named on it builds it, test-first, keeping the route, its role and its response.
 */
final class OrderDocumentController extends AbstractController
{
    /**
     * The order as a PDF (the printer's). (item 4).
     */
    #[Route('/api/v1/orders/{id}/pdf', name: 'api_orders_pdf', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CAN_READ_ORDERS')]
    public function pdf(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * What is left to ship, as a PDF. (item 4).
     */
    #[Route('/api/v1/orders/{id}/remaining-pdf', name: 'api_orders_remaining_pdf', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CAN_READ_ORDERS')]
    public function remainingPdf(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * The order as a spreadsheet (as before: any signed-in user). (item 4).
     */
    #[Route('/api/v1/orders/{id}/xls', name: 'api_orders_xls', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    public function xls(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }
}
