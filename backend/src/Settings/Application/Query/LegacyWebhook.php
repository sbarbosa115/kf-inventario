<?php

namespace App\Settings\Application\Query;

/** The hits on the old webhook URL (a 410 tombstone) since the deploy. */
final readonly class LegacyWebhook
{
    public function __construct(
        public int $hits,
        public ?\DateTimeImmutable $lastHitAt,
    ) {
    }
}
