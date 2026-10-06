<?php

namespace App\Settings\Application\Command;

use App\Settings\Application\Query\WebhookSettings;
use App\Settings\Domain\Model\SettingKey;
use App\Settings\Domain\Repository\SettingRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;
use App\Shared\Domain\Clock;

/** Turning the legacy URL off starts its hit counter from zero: every hit after that is a shop not re-pointed. */
final class SaveWebhookSettingsHandler implements CommandHandler
{
    public function __construct(
        private readonly SettingRepository $settings,
        private readonly WebhookSettings $webhooks,
        private readonly Clock $clock,
        private readonly ActivityLog $activity,
    ) {
    }

    public function __invoke(SaveWebhookSettings $command): void
    {
        $now = $this->clock->now();
        if ($this->webhooks->legacyEnabled() && !$command->legacyEnabled) {
            $this->settings->put(SettingKey::WEBHOOKS_LEGACY_HITS, '0', false, $now, $command->actorId);
            $this->settings->put(SettingKey::WEBHOOKS_LEGACY_LAST_HIT_AT, null, false, $now, $command->actorId);
        }
        $this->settings->put(SettingKey::WEBHOOKS_LEGACY_ENABLED, $command->legacyEnabled ? '1' : '0', false, $now, $command->actorId);

        $this->activity->record('Settings', $command->legacyEnabled ? 'The legacy webhook URL was turned on.' : 'The legacy webhook URL was turned off.', ['keys' => [SettingKey::WEBHOOKS_LEGACY_ENABLED]]);
    }
}
