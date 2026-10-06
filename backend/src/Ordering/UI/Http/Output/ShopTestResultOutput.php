<?php

namespace App\Ordering\UI\Http\Output;

/** "Test connection": the REST API answered with these keys or not; the webhook URL to paste. Never throws. */
final readonly class ShopTestResultOutput
{
    public function __construct(
        public ShopRestTestOutput $rest,
        public ?string $webhookUrl,
        public bool $webhookSecretSet,
    ) {
    }
}
