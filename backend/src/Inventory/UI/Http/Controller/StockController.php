<?php

namespace App\Inventory\UI\Http\Controller;

use App\Inventory\UI\Http\Output\ApprovedOutput;
use App\Inventory\UI\Http\Output\StockOutput;
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
final class StockController extends AbstractController
{
    /**
     * The warehouse's stock rows with `status` (1 in stock, default; 0 incoming). (item 2).
     */
    #[Route('/api/v1/warehouses/{id}/stock', name: 'api_stock_list', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    #[ApiResponse(StockOutput::class, list: true)]
    public function list(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * StockLinesInput: moves quantities to another warehouse (they arrive as incoming). 204; 409 same_warehouse; 404 stock_not_found; 422 insufficient_stock. (item 2).
     */
    #[Route('/api/v1/warehouses/{from}/moves/{to}', name: 'api_stock_move', methods: ['POST'], requirements: ['from' => '\d+', 'to' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    public function move(int $from, int $to): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * StockLinesInput (by code): the barcode reader adds stock. 204. (item 2).
     */
    #[Route('/api/v1/warehouses/{id}/stock/add', name: 'api_stock_add', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    public function add(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * StockLinesInput (by code): the barcode reader removes stock. 204; 422 insufficient_stock. (item 2).
     */
    #[Route('/api/v1/warehouses/{id}/stock/remove', name: 'api_stock_remove', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    public function remove(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * Approves every incoming row of the warehouse. (item 2).
     */
    #[Route('/api/v1/warehouses/{id}/incoming/approve', name: 'api_stock_approve_incoming', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    #[ApiResponse(ApprovedOutput::class)]
    public function approveIncoming(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }
}
