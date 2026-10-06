<?php

namespace App\Settings\Application\Query;

use App\Settings\Domain\Model\SettingKey;

/**
 * What reached the old webhook URL, a 410 tombstone since the legacy webhook was removed (docs/pdr/prd-shops-settings.md,
 * "Decision (user, 2026-10-06)"): any hit is a shop still pointing at it.
 */
final class WebhookSettings
{
    public function __construct(private readonly SettingValues $values)
    {
    }

    public function legacy(): LegacyWebhook
    {
        $last = $this->values->get(SettingKey::WEBHOOKS_LEGACY_LAST_HIT_AT);

        return new LegacyWebhook(
            (int) $this->values->get(SettingKey::WEBHOOKS_LEGACY_HITS),
            null === $last ? null : new \DateTimeImmutable($last),
        );
    }
}
