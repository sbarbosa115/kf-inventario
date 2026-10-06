<?php

namespace App\Ordering\UI\Http\Output;

/** What to paste in WooCommerce › Settings › Advanced › Webhooks: the delivery URL and the secret. */
final readonly class WebhookSecretOutput
{
    public function __construct(
        public string $webhookSecret,
        public string $webhookUrl,
    ) {
    }
}
