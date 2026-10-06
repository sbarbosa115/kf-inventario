<?php

namespace App\Settings\Application\Command;

use App\Settings\Application\Query\AnalyticsSettings;
use App\Settings\Application\Query\SettingValues;
use App\Settings\Domain\Error\InvalidSetting;
use App\Settings\Domain\Model\SettingKey;
use App\Settings\Domain\Repository\SettingRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;
use App\Shared\Domain\Clock;

/**
 * The ids are checked by shape here too (the loader puts them in a script URL: docs/pdr/prd-shops-settings.md,
 * Security), not only on the Input DTO. Logged by key, not value, and only the keys that changed.
 */
final class SaveAnalyticsSettingsHandler implements CommandHandler
{
    public function __construct(
        private readonly SettingRepository $settings,
        private readonly SettingValues $values,
        private readonly Clock $clock,
        private readonly ActivityLog $activity,
    ) {
    }

    public function __invoke(SaveAnalyticsSettings $command): void
    {
        $ga4 = '' === trim((string) $command->ga4MeasurementId) ? null : trim((string) $command->ga4MeasurementId);
        $clarity = '' === trim((string) $command->clarityProjectId) ? null : trim((string) $command->clarityProjectId);
        if (null !== $ga4 && 1 !== preg_match(AnalyticsSettings::GA4_PATTERN, $ga4)) {
            throw new InvalidSetting('ga4_measurement_id', 'This is not a GA4 Measurement ID (G-XXXXXXX).');
        }
        if (null !== $clarity && 1 !== preg_match(AnalyticsSettings::CLARITY_PATTERN, $clarity)) {
            throw new InvalidSetting('clarity_project_id', 'This is not a Clarity Project ID.');
        }
        $now = $this->clock->now();
        $changed = [];
        foreach ([SettingKey::ANALYTICS_GA4_ID => $ga4, SettingKey::ANALYTICS_CLARITY_ID => $clarity] as $key => $value) {
            if ($this->values->get($key) !== $value) {
                $this->settings->put($key, $value, false, $now, $command->actorId);
                $changed[] = $key;
            }
        }

        if ([] !== $changed) {
            $this->activity->record('Settings', 'Analytics settings were changed.', ['keys' => $changed]);
        }
    }
}
