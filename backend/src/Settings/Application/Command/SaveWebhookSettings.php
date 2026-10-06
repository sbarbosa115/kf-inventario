<?php

namespace App\Settings\Application\Command;

/** The legacy webhook URL's switch (Decisions 8). */
final readonly class SaveWebhookSettings
{
    public function __construct(
        public bool $legacyEnabled,
        public ?int $actorId = null,
    ) {
    }
}
