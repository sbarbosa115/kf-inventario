<?php

namespace App\Ordering\UI\Http\Controller;

use App\Ordering\UI\Http\Output\OrderCommentOutput;
use App\Ordering\UI\Http\Output\OrderDetailOutput;
use App\Ordering\UI\Http\Output\OrderOutput;
use App\Ordering\UI\Http\Output\SyncResultOutput;
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
final class OrderController extends AbstractController
{
    /**
     * `warehouse_id`: that warehouse's orders, newest first. (item 4).
     */
    #[Route('/api/v1/orders', name: 'api_orders_list', methods: ['GET'])]
    #[IsGranted('ROLE_CAN_READ_ORDERS')]
    #[ApiResponse(OrderOutput::class, list: true)]
    public function list(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * One order. 404 order_not_found. (item 4).
     */
    #[Route('/api/v1/orders/{id}', name: 'api_orders_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CAN_READ_ORDERS')]
    #[ApiResponse(OrderDetailOutput::class)]
    public function show(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * OrderInput: places an order; the printer gets its email. 422 order_without_products. (item 4).
     */
    #[Route('/api/v1/orders', name: 'api_orders_create', methods: ['POST'])]
    #[IsGranted('ROLE_CAN_CREATE_ORDERS')]
    #[ApiResponse(OrderDetailOutput::class, status: 201)]
    public function create(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * OrderInput: edits an order. (item 4).
     */
    #[Route('/api/v1/orders/{id}', name: 'api_orders_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CAN_UPDATE_ORDERS')]
    #[ApiResponse(OrderDetailOutput::class)]
    public function update(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * OrderStatusInput: moves the order to another status. (item 4).
     */
    #[Route('/api/v1/orders/{id}/status', name: 'api_orders_status', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_UPDATE_ORDERS')]
    #[ApiResponse(OrderDetailOutput::class)]
    public function changeStatus(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * OrderCommentsInput: the order's comments as they should be (as before: any signed-in user). (item 4).
     */
    #[Route('/api/v1/orders/{id}/comments', name: 'api_orders_comments', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_USER')]
    #[ApiResponse(OrderCommentOutput::class, list: true, key: 'comments')]
    public function syncComments(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * Deletes an order (its products and comments, then the order: soft delete). 204. (item 4).
     */
    #[Route('/api/v1/orders/{id}', name: 'api_orders_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CAN_DELETE_ORDERS')]
    public function delete(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * Pulls new orders from the WooCommerce shops (item 13). 501 order_sync_unavailable until then; 502 order_sync_failed. (item 13).
     */
    #[Route('/api/v1/orders/sync', name: 'api_orders_sync', methods: ['POST'])]
    #[IsGranted('ROLE_CAN_SYNC_ORDERS')]
    #[ApiResponse(SyncResultOutput::class, status: 202)]
    public function sync(): JsonResponse
    {
        throw new ApiException(501, 'order_sync_unavailable', 'Pulling orders from WooCommerce is not available yet.');
    }
}
