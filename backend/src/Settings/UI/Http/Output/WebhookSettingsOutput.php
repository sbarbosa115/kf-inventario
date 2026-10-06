<?php

namespace App\Settings\UI\Http\Output;

/** The legacy webhook URL's switch, and what reached it since it was turned off. */
final readonly class WebhookSettingsOutput
{
    public function __construct(
        public bool $legacyEnabled,
        public int $legacyHitsSince,
        /** ISO 8601 */
        public ?string $legacyLastHitAt,
    ) {
    }
}
