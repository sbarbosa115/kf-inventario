<?php

namespace App\Settings\UI\Http\Output;

/** What reached the old webhook URL (a 410 tombstone) since the deploy: any hit is a shop not re-pointed. */
final readonly class WebhookSettingsOutput
{
    public function __construct(
        public int $legacyHits,
        /** ISO 8601 */
        public ?string $legacyLastHitAt,
    ) {
    }
}
