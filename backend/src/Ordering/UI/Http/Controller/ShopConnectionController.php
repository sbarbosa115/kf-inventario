<?php

namespace App\Ordering\UI\Http\Controller;

use App\Ordering\UI\Http\Output\ShopConnectionOutput;
use App\Ordering\UI\Http\Output\ShopDeliveryDetailOutput;
use App\Ordering\UI\Http\Output\ShopDeliveryOutput;
use App\Ordering\UI\Http\Output\ShopTestResultOutput;
use App\Ordering\UI\Http\Output\WebhookSecretOutput;
use App\Shared\UI\Http\ApiException;
use App\Shared\UI\Http\ApiResponse;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Shop connections and their failed-deliveries inbox (docs/pdr/prd-shops-settings.md, "API changes" › Shop
 * connections), for an admin. Item 5a (shops-api) builds them; the routes, roles and answers are the contract, 501
 * until then. Bodies: Input\ShopConnectionInput, Input\ShopTestInput.
 */
#[IsGranted('ROLE_ADMIN')]
final class ShopConnectionController extends AbstractController
{
    /**
     * Every connection by name, with its health.
     */
    #[Route('/api/v1/shops', name: 'api_shops_list', methods: ['GET'])]
    #[ApiResponse(ShopConnectionOutput::class, list: true)]
    public function list(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * One connection. 404 shop_not_found.
     */
    #[Route('/api/v1/shops/{id}', name: 'api_shops_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[ApiResponse(ShopConnectionOutput::class)]
    public function show(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * ShopConnectionInput → 201 with `webhook_secret` (once) and `webhook_url`. 409 shop_url_taken, shop_name_taken;
     * 404 warehouse_not_found; 422 shop_url_invalid (not https, a private host).
     */
    #[Route('/api/v1/shops', name: 'api_shops_create', methods: ['POST'])]
    #[ApiResponse(ShopConnectionOutput::class, status: 201)]
    public function create(): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * ShopConnectionInput: blank consumer_key/consumer_secret keep the saved ones. 404 shop_not_found.
     */
    #[Route('/api/v1/shops/{id}', name: 'api_shops_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[ApiResponse(ShopConnectionOutput::class)]
    public function update(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * 204; 409 shop_has_orders when orders came from it (deactivate it instead).
     */
    #[Route('/api/v1/shops/{id}', name: 'api_shops_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id): Response
    {
        throw ApiException::notImplemented();
    }

    /**
     * The webhook URL and signing secret to paste in WooCommerce (the consumer secret is never readable).
     */
    #[Route('/api/v1/shops/{id}/webhook-secret', name: 'api_shops_webhook_secret', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[ApiResponse(WebhookSecretOutput::class)]
    public function webhookSecret(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * Rotates the signing secret → the new one, to paste.
     */
    #[Route('/api/v1/shops/{id}/webhook-secret', name: 'api_shops_webhook_secret_rotate', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[ApiResponse(WebhookSecretOutput::class)]
    public function rotateWebhookSecret(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * ShopTestInput (the keys as typed, else the saved ones): "Test connection", 15 s, never an error status.
     */
    #[Route('/api/v1/shops/{id}/test', name: 'api_shops_test', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[ApiResponse(ShopTestResultOutput::class)]
    public function test(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * A page of the connection's inbox (`?status=failed`; the list contract).
     */
    #[Route('/api/v1/shops/{id}/deliveries', name: 'api_shops_deliveries', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[ApiResponse(ShopDeliveryOutput::class, page: true)]
    public function deliveries(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * One inbox row with its body. 404 delivery_not_found.
     */
    #[Route('/api/v1/shops/{id}/deliveries/{deliveryId}', name: 'api_shops_delivery', methods: ['GET'], requirements: ['id' => '\d+', 'deliveryId' => '\d+'])]
    #[ApiResponse(ShopDeliveryDetailOutput::class)]
    public function delivery(int $id, int $deliveryId): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * Runs the import again from the stored body: `placed` with its order, or still `failed` with the new reason.
     */
    #[Route('/api/v1/shops/{id}/deliveries/{deliveryId}/retry', name: 'api_shops_delivery_retry', methods: ['POST'], requirements: ['id' => '\d+', 'deliveryId' => '\d+'])]
    #[ApiResponse(ShopDeliveryOutput::class)]
    public function retryDelivery(int $id, int $deliveryId): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * Marks the row discarded.
     */
    #[Route('/api/v1/shops/{id}/deliveries/{deliveryId}/discard', name: 'api_shops_delivery_discard', methods: ['POST'], requirements: ['id' => '\d+', 'deliveryId' => '\d+'])]
    #[ApiResponse(ShopDeliveryOutput::class)]
    public function discardDelivery(int $id, int $deliveryId): JsonResponse
    {
        throw ApiException::notImplemented();
    }
}
