<?php

namespace App\Inventory\UI\Http\Controller;

use App\Inventory\UI\Http\Output\WarehouseOutput;
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
final class WarehouseController extends AbstractController
{
    /**
     * Every warehouse (as /admin/warehouse/all: any signed-in user). (item 2).
     */
    #[Route('/api/v1/warehouses', name: 'api_warehouses_list', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(WarehouseOutput::class, list: true)]
    public function list(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * WarehouseInput: renames a warehouse (as the legacy edit: any signed-in user). (item 2).
     */
    #[Route('/api/v1/warehouses/{id}', name: 'api_warehouses_rename', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(WarehouseOutput::class)]
    public function rename(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }
}
