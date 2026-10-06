<?php

namespace App\Ordering\UI\Http\Controller;

use App\Shared\UI\Http\ApiException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/**
 * A connection's own webhook (docs/pdr/prd-shops-settings.md, "Shop connections"): public (security.yaml), outside
 * /api/ and the SPA; the token in the path names the connection, X-WC-Webhook-Signature (HMAC-SHA256 of the raw body
 * with its secret) is required. Item 5a builds it; 501 until then.
 */
final class ShopWebhookController extends AbstractController
{
    #[Route('/webhooks/shops/{token}', name: 'shop_webhook', methods: ['POST', 'GET'], requirements: ['token' => '[A-Za-z0-9]{1,64}'])]
    public function __invoke(string $token): JsonResponse
    {
        throw ApiException::notImplemented();
    }
}
