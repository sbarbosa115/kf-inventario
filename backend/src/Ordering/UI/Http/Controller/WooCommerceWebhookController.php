<?php

namespace App\Ordering\UI\Http\Controller;

use App\Settings\Application\Command\RecordLegacyWebhookHit;
use App\Shared\Application\Command\CommandBus;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * The legacy WooCommerce webhook URL, now a tombstone (docs/pdr/prd-shops-settings.md, "Decision (user, 2026-10-06):
 * the legacy webhook is removed"): each shop posts to its connection's URL (/webhooks/shops/{token}). Whatever reaches
 * the old path answers 410 {status: false, error: "webhook_moved"} — WooCommerce shows it in the webhook's delivery
 * log and, after its retries, disables that webhook — places nothing, keeps no body and counts the hit (Settings ›
 * General, the warning on Orders), so a shop that was never re-pointed is visible. Public (security.yaml), outside
 * /api/ and the SPA; the route name is the legacy one.
 */
final class WooCommerceWebhookController extends AbstractController
{
    public function __construct(
        private readonly CommandBus $commands,
        private readonly LoggerInterface $logger,
    ) {
    }

    #[Route('/admin/order/1H39j0jpQPsWL958v9R4', name: 'order_create_webhook', methods: ['POST', 'GET'])]
    public function __invoke(Request $request): JsonResponse
    {
        $this->commands->dispatch(new RecordLegacyWebhookHit());
        $this->logger->warning(\sprintf('WooCommerce delivery from [%s] refused: the old webhook URL is gone (410); point the shop at its connection\'s URL.', $request->headers->get('X-WC-Webhook-Source')));

        return new JsonResponse(['status' => false, 'error' => 'webhook_moved'], 410);
    }
}
