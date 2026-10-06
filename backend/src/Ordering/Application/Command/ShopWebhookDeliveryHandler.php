<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopDelivery;
use App\Ordering\Domain\Repository\ShopConnectionRepository;
use App\Settings\Application\Port\SecretBox;
use App\Settings\Application\Port\UnreadableSecret;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Domain\Clock;

/**
 * A delivery to a connection's webhook (docs/pdr/prd-shops-settings.md, "Shop connections" and Security). The token
 * names the connection; the signature — base64(HMAC-SHA256(raw body, the connection's secret)), compared in constant
 * time — is required (Decisions 5). A refused signature is kept (no body) and shows in the connection's health; an
 * inactive connection keeps the order in the inbox; otherwise the order is placed in the connection's warehouse
 * (ShopOrderImport). Every outcome commits: the answer is a result, not an exception.
 */
final class ShopWebhookDeliveryHandler implements CommandHandler
{
    public function __construct(
        private readonly ShopConnectionRepository $connections,
        private readonly ShopOrderImport $import,
        private readonly SecretBox $box,
        private readonly Clock $clock,
    ) {
    }

    public function __invoke(ShopWebhookDelivery $command): ShopWebhookOutcome
    {
        $connection = $this->connections->byWebhookToken($command->token);
        if (null === $connection) {
            return ShopWebhookOutcome::UnknownToken;
        }
        $now = $this->clock->now();
        if ($command->ping) {
            $connection->recordWebhook($now);

            return ShopWebhookOutcome::Accepted;
        }
        if (!$this->signed($connection, $command)) {
            $reason = 'A delivery was refused: its X-WC-Webhook-Signature does not match this connection\'s secret (paste the secret again in WooCommerce).';
            $this->import->keep($connection, ShopDelivery::KIND_WEBHOOK, null, ShopDelivery::REASON_BAD_SIGNATURE, $reason, null);
            $connection->recordFailure($now, ShopDelivery::REASON_BAD_SIGNATURE, $reason);

            return ShopWebhookOutcome::BadSignature;
        }

        $connection->recordWebhook($now);
        $shopOrder = json_decode($command->body, true);
        if (!$connection->isActive()) {
            $remoteId = \is_array($shopOrder) && \is_scalar($shopOrder['id'] ?? null) ? (string) $shopOrder['id'] : null;
            $this->import->keep($connection, ShopDelivery::KIND_WEBHOOK, $remoteId, ShopDelivery::REASON_INACTIVE, 'The connection is inactive: activate it, then Retry.', $command->body);

            return ShopWebhookOutcome::Accepted;
        }

        $this->import->import($connection, (int) $connection->warehouse()->getId(), $connection->emailsPrinter(), ShopDelivery::KIND_WEBHOOK, $shopOrder, $command->body, $connection->name());

        return ShopWebhookOutcome::Accepted;
    }

    private function signed(ShopConnection $connection, ShopWebhookDelivery $command): bool
    {
        if (null === $command->signature || '' === $command->signature) {
            return false;
        }
        try {
            $secret = $this->box->open($connection->sealedWebhookSecret());
        } catch (UnreadableSecret) {
            return false;
        }

        return hash_equals(base64_encode(hash_hmac('sha256', $command->body, $secret, true)), $command->signature);
    }
}
