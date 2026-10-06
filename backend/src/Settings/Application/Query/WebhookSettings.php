<?php

namespace App\Settings\Application\Query;

use App\Settings\Domain\Model\SettingKey;

/**
 * The legacy webhook URL's switch (docs/pdr/prd-shops-settings.md, Decisions 8): on until the admin turns it off in
 * Settings › General — no row means on, so the deploy changes nothing for the shops.
 */
final class WebhookSettings
{
    public function __construct(private readonly SettingValues $values)
    {
    }

    public function legacyEnabled(): bool
    {
        return '0' !== $this->values->get(SettingKey::WEBHOOKS_LEGACY_ENABLED);
    }

    public function legacy(): LegacyWebhook
    {
        $last = $this->values->get(SettingKey::WEBHOOKS_LEGACY_LAST_HIT_AT);

        return new LegacyWebhook(
            $this->legacyEnabled(),
            (int) $this->values->get(SettingKey::WEBHOOKS_LEGACY_HITS),
            null === $last ? null : new \DateTimeImmutable($last),
        );
    }
}
