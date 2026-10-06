<?php

namespace App\Settings\Application\Command;

use App\Settings\Application\Query\SettingValues;
use App\Settings\Domain\Model\SettingKey;
use App\Settings\Domain\Repository\SettingRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Domain\Clock;

final class RecordLegacyWebhookHitHandler implements CommandHandler
{
    public function __construct(
        private readonly SettingRepository $settings,
        private readonly SettingValues $values,
        private readonly Clock $clock,
    ) {
    }

    public function __invoke(RecordLegacyWebhookHit $command): void
    {
        $now = $this->clock->now();
        $hits = (int) $this->values->get(SettingKey::WEBHOOKS_LEGACY_HITS);
        $this->settings->put(SettingKey::WEBHOOKS_LEGACY_HITS, (string) ($hits + 1), false, $now);
        $this->settings->put(SettingKey::WEBHOOKS_LEGACY_LAST_HIT_AT, $now->format(\DATE_ATOM), false, $now);
    }
}
