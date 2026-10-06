<?php

namespace App\Ordering\UI\Http\Controller;

use App\Ordering\Application\Command\ImportShopOrder;
use App\Ordering\UI\Http\Security\WooCommerceWebhookSignature;
use App\Settings\Application\Command\RecordLegacyWebhookHit;
use App\Settings\Application\Query\WebhookSettings;
use App\Shared\Application\Command\CommandBus;
use App\Shared\Domain\Error\DomainError;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * The WooCommerce webhook: the shops post each new order here. The URL and the route name are the legacy ones (the
 * shops are configured with it): public (security.yaml), outside /api/ and the SPA. The shop always gets
 * {status: true}; what could not be placed is logged. With WOO_COMMERCE_WEBHOOK_SECRET set, a delivery without the
 * shop's signature is logged and not placed (WooCommerceWebhookSignature).
 *
 * The connections of shops-settings replace it (/webhooks/shops/{token}): once the admin turns this URL off in
 * Settings › General, it answers 410 {status: false, error: "webhook_moved"}, places nothing and counts the hit
 * (docs/pdr/prd-shops-settings.md, Decisions 8). On (the default after the deploy), it works as before.
 */
final class WooCommerceWebhookController extends AbstractController
{
    public function __construct(
        private readonly CommandBus $commands,
        private readonly LoggerInterface $logger,
        private readonly WooCommerceWebhookSignature $signature,
        private readonly WebhookSettings $webhooks,
    ) {
    }

    #[Route('/admin/order/1H39j0jpQPsWL958v9R4', name: 'order_create_webhook', methods: ['POST', 'GET'])]
    public function __invoke(Request $request): JsonResponse
    {
        $source = $request->headers->get('X-WC-Webhook-Source');
        if (!$this->webhooks->legacyEnabled()) {
            $this->commands->dispatch(new RecordLegacyWebhookHit());
            $this->logger->warning(\sprintf('WooCommerce delivery from [%s] refused: the legacy webhook URL is turned off (410).', $source));

            return new JsonResponse(['status' => false, 'error' => 'webhook_moved'], 410);
        }
        if (!$this->signature->accepts($request->getContent(), $request->headers->get('X-WC-Webhook-Signature'))) {
            $this->logger->warning(\sprintf('WooCommerce delivery from [%s] refused: missing or wrong X-WC-Webhook-Signature.', $source));

            return new JsonResponse(['status' => true]);
        }
        $shopOrder = json_decode($request->getContent(), true);

        try {
            $this->commands->dispatch(new ImportShopOrder($source, \is_array($shopOrder) ? $shopOrder : []));
        } catch (DomainError|\UnexpectedValueException $e) {
            $this->logger->error(\sprintf('WooCommerce order from [%s] was not placed: %s', $source, $e->getMessage()), ['exception' => $e]);
        }

        return new JsonResponse(['status' => true]);
    }
}
