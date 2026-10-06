<?php

namespace App\Ordering\UI\Http\Output;

/** A connection's health, written by the webhook, the pull and the pusher. Dates ISO 8601. */
final readonly class ShopHealthOutput
{
    public function __construct(
        public ?string $lastWebhookAt,
        public ?string $lastImportAt,
        public ?string $lastPullAt,
        public ?string $lastPullOkAt,
        public ?string $lastFailureAt,
        /** bad_signature, unknown_product, keys_read_only, unreachable… */
        public ?string $lastFailureCode,
        public ?string $lastFailure,
        /** Deliveries waiting in the inbox */
        public int $failedDeliveries,
        /** Writes to the shop that failed every retry */
        public int $failedPushes,
    ) {
    }
}
