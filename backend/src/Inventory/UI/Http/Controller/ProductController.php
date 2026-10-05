<?php

namespace App\Inventory\UI\Http\Controller;

use App\Inventory\UI\Http\Output\ProductOutput;
use App\Inventory\UI\Http\Output\UploadResultOutput;
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
final class ProductController extends AbstractController
{
    /**
     * A product by its code (the barcode reader). 404 product_not_found. (item 2).
     */
    #[Route('/api/v1/products/by-code/{code}', name: 'api_products_by_code', methods: ['GET'], requirements: ['code' => '[^/]+'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    #[ApiResponse(ProductOutput::class)]
    public function byCode(string $code): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * A product by uuid. 404 product_not_found. (item 2).
     */
    #[Route('/api/v1/products/{uuid}', name: 'api_products_show', methods: ['GET'], requirements: ['uuid' => '[0-9a-f-]{36}'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    #[ApiResponse(ProductOutput::class)]
    public function show(string $uuid): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * ProductInput: creates a product. (item 2).
     */
    #[Route('/api/v1/products', name: 'api_products_create', methods: ['POST'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    #[ApiResponse(ProductOutput::class, status: 201)]
    public function create(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * ProductInput: edits a product. (item 2).
     */
    #[Route('/api/v1/products/{uuid}', name: 'api_products_update', methods: ['PUT'], requirements: ['uuid' => '[0-9a-f-]{36}'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    #[ApiResponse(ProductOutput::class)]
    public function update(string $uuid): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * multipart: `file` (xls/xlsx, the template's columns) and `warehouse_id`. 415 unsupported_media; 422 invalid_spreadsheet. (item 2).
     */
    #[Route('/api/v1/products/upload', name: 'api_products_upload', methods: ['POST'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    #[ApiResponse(UploadResultOutput::class)]
    public function upload(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * The stock spreadsheet: `all=1` for every product, or `uuid[]=…` for the selected ones (an xls attachment). (item 2).
     */
    #[Route('/api/v1/products/template.xls', name: 'api_products_template', methods: ['GET'])]
    #[IsGranted('ROLE_MANAGE_INVENTORY')]
    public function template(): JsonResponse
    {
        throw ApiException::notImplemented();
    }
}
