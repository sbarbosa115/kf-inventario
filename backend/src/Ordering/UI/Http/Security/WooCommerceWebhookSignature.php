<?php

namespace App\Ordering\UI\Http\Security;

use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * WooCommerce signs every webhook delivery: X-WC-Webhook-Signature is base64(HMAC-SHA256(body, the webhook's secret)).
 * With WOO_COMMERCE_WEBHOOK_SECRET empty (the default) nothing is checked, as before: the secret URL and the
 * X-WC-Webhook-Source header are the only gate. Set it to the shop's webhook secret (WooCommerce › Settings › Advanced
 * › Webhooks › Secret) and an unsigned or forged delivery is refused.
 */
final class WooCommerceWebhookSignature
{
    public function __construct(
        #[Autowire('%env(default::WOO_COMMERCE_WEBHOOK_SECRET)%')]
        private readonly ?string $secret = null,
    ) {
    }

    public function accepts(string $body, ?string $signature): bool
    {
        $secret = (string) $this->secret;
        if ('' === $secret) {
            return true;
        }

        return null !== $signature && hash_equals(base64_encode(hash_hmac('sha256', $body, $secret, true)), $signature);
    }
}
