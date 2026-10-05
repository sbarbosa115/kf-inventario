<?php

namespace App\Ordering\UI\Http\Controller;

use App\Ordering\UI\Http\Output\OrderPartialsOutput;
use App\Shared\UI\Http\ApiException;
use App\Shared\UI\Http\ApiResponse;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * The contract of this context's endpoints (docs/pdr/prd-restructure.md, the route map): each answers 501
 * not_implemented until the item named on it builds it, test-first, keeping the route, its role and its response.
 */
final class OrderPartialController extends AbstractController
{
    /**
     * What was shipped, what is left, and the stock (as before: any signed-in user). (item 4).
     */
    #[Route('/api/v1/orders/{id}/partials', name: 'api_orders_partials', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(OrderPartialsOutput::class)]
    public function show(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * PartialInput: records a partial shipment. 409 partial_exceeds_order. (item 4).
     */
    #[Route('/api/v1/orders/{id}/partials', name: 'api_orders_partials_record', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(OrderPartialsOutput::class)]
    public function record(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }
}
