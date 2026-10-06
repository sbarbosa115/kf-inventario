<?php

namespace App\Ordering\Application\Command;

/**
 * What a shop posted to /webhooks/shops/{token}: the raw body (the signature is over it, not the parsed JSON) and its
 * X-WC-Webhook-Signature. A ping is WooCommerce checking the URL when a webhook is saved (unsigned, no order).
 */
final readonly class ShopWebhookDelivery
{
    public function __construct(
        public string $token,
        public string $body,
        public ?string $signature,
        public bool $ping = false,
    ) {
    }
}
