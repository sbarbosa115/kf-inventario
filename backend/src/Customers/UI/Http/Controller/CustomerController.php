<?php

namespace App\Customers\UI\Http\Controller;

use App\Customers\UI\Http\Output\CustomerOutput;
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
final class CustomerController extends AbstractController
{
    /**
     * `page` (1…), `per_page` (100 by default, as before). (item 3).
     */
    #[Route('/api/v1/customers', name: 'api_customers_page', methods: ['GET'])]
    #[IsGranted('ROLE_MANAGE_CUSTOMERS')]
    #[ApiResponse(CustomerOutput::class, page: true)]
    public function page(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * Every customer, for the order and invoice pickers. (item 3).
     */
    #[Route('/api/v1/customers/all', name: 'api_customers_all', methods: ['GET'])]
    #[IsGranted('ROLE_MANAGE_CUSTOMERS')]
    #[ApiResponse(CustomerOutput::class, list: true)]
    public function all(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * One customer. 404 customer_not_found. (item 3).
     */
    #[Route('/api/v1/customers/{id}', name: 'api_customers_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_CUSTOMERS')]
    #[ApiResponse(CustomerOutput::class)]
    public function show(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * CustomerInput: creates a customer. (item 3).
     */
    #[Route('/api/v1/customers', name: 'api_customers_create', methods: ['POST'])]
    #[IsGranted('ROLE_MANAGE_CUSTOMERS')]
    #[ApiResponse(CustomerOutput::class, status: 201)]
    public function create(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * CustomerInput: edits a customer and replaces their addresses. (item 3).
     */
    #[Route('/api/v1/customers/{id}', name: 'api_customers_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_CUSTOMERS')]
    #[ApiResponse(CustomerOutput::class)]
    public function update(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * Deletes a customer (soft delete, as before). 204. (item 3).
     */
    #[Route('/api/v1/customers/{id}', name: 'api_customers_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_MANAGE_CUSTOMERS')]
    public function delete(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }
}
