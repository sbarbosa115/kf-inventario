<?php

namespace App\Ordering\UI\Http\Controller;

use App\Ordering\UI\Http\Output\ShopOutboxOutput;
use App\Shared\UI\Http\ApiException;
use App\Shared\UI\Http\ApiResponse;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * What the app writes back to a shop and how it went (docs/pdr/prd-shops-settings.md, Decisions 10), for an admin.
 * Item 5b (shops-sync-api) builds it; 501 until then.
 */
#[IsGranted('ROLE_ADMIN')]
final class ShopOutboxController extends AbstractController
{
    /**
     * The connection's writes in a status (`?status=failed`).
     */
    #[Route('/api/v1/shops/{id}/outbox', name: 'api_shops_outbox', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[ApiResponse(ShopOutboxOutput::class, list: true)]
    public function list(int $id): JsonResponse
    {
        throw ApiException::notImplemented();
    }

    /**
     * Queues a failed write again → pending.
     */
    #[Route('/api/v1/shops/{id}/outbox/{outboxId}/retry', name: 'api_shops_outbox_retry', methods: ['POST'], requirements: ['id' => '\d+', 'outboxId' => '\d+'])]
    #[ApiResponse(ShopOutboxOutput::class)]
    public function retry(int $id, int $outboxId): JsonResponse
    {
        throw ApiException::notImplemented();
    }
}
