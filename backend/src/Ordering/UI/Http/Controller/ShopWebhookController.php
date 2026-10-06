<?php

namespace App\Ordering\UI\Http\Controller;

use App\Ordering\Application\Command\ShopWebhookDelivery;
use App\Ordering\Application\Command\ShopWebhookOutcome;
use App\Shared\Application\Command\CommandBus;
use App\Shared\Domain\Error\DomainError;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * A connection's own webhook (docs/pdr/prd-shops-settings.md, "Shop connections" and Security): public
 * (security.yaml), outside /api/ and the SPA. The token in the path names the connection; X-WC-Webhook-Signature
 * (base64 HMAC-SHA256 of the raw body with its secret) is required.
 *
 * Answers: 200 {status: true} for every accepted delivery (placed, a duplicate, or kept in the inbox: the shop must
 * not retry it); 401 {status: false} for a missing or wrong signature (kept without its body, in the health); 404
 * {status: false} for an unknown token (nothing stored); 413 for a body over 1 MB (refused before it is parsed).
 * GET, and the unsigned `webhook_id=<id>` form WooCommerce posts when a webhook is saved, are its checks that the URL
 * answers: 200, and the connection's "last webhook" moves.
 */
final class ShopWebhookController extends AbstractController
{
    public const MAX_BODY = 1024 * 1024;

    public function __construct(
        private readonly CommandBus $commands,
        private readonly LoggerInterface $logger,
    ) {
    }

    #[Route('/webhooks/shops/{token}', name: 'shop_webhook', methods: ['POST', 'GET'], requirements: ['token' => '[A-Za-z0-9]{1,64}'])]
    public function __invoke(Request $request, string $token): JsonResponse
    {
        if ((int) $request->headers->get('Content-Length', '0') > self::MAX_BODY) {
            return new JsonResponse(['status' => false], 413);
        }
        $body = $request->isMethod('GET') ? '' : $request->getContent();
        if (\strlen($body) > self::MAX_BODY) {
            return new JsonResponse(['status' => false], 413);
        }
        $ping = $request->isMethod('GET') || 1 === preg_match('/^webhook_id=\d+$/', $body);
        $signature = $request->headers->get('X-WC-Webhook-Signature');
        // The token is the connection's credential: only its first characters go to the logs.
        $named = substr($token, 0, 6).'…';

        try {
            $outcome = $this->commands->dispatch(new ShopWebhookDelivery($token, $body, $signature, $ping));
        } catch (DomainError $e) {
            $this->logger->error(\sprintf('Shop webhook [%s]: the order was not placed: %s', $named, $e->getMessage()), ['exception' => $e]);

            return new JsonResponse(['status' => true]);
        }

        return match ($outcome) {
            ShopWebhookOutcome::UnknownToken => $this->refused(404, \sprintf('Shop webhook [%s] refused: no connection has this token.', $named)),
            ShopWebhookOutcome::BadSignature => $this->refused(401, \sprintf('Shop webhook [%s] refused: missing or wrong X-WC-Webhook-Signature.', $named)),
            default => new JsonResponse(['status' => true]),
        };
    }

    private function refused(int $status, string $why): JsonResponse
    {
        $this->logger->warning($why);

        return new JsonResponse(['status' => false], $status);
    }
}
