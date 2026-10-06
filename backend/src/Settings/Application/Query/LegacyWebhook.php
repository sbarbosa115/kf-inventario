<?php

namespace App\Settings\Application\Query;

/** The cutover switch of the legacy webhook URL and what reached it since it was turned off. */
final readonly class LegacyWebhook
{
    public function __construct(
        public bool $enabled,
        public int $hitsSince,
        public ?\DateTimeImmutable $lastHitAt,
    ) {
    }
}
