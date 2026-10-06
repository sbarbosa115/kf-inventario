<?php

namespace App\Settings\Application\Command;

use App\Settings\Application\Query\AnalyticsSettings;
use App\Settings\Domain\Error\InvalidSetting;
use App\Settings\Domain\Model\SettingKey;
use App\Settings\Domain\Repository\SettingRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;
use App\Shared\Domain\Clock;

/**
 * The ids are checked by shape here too (the loader puts them in a script URL: docs/pdr/prd-shops-settings.md,
 * Security), not only on the Input DTO.
 */
final class SaveAnalyticsSettingsHandler implements CommandHandler
{
    public function __construct(
        private readonly SettingRepository $settings,
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
        $this->settings->put(SettingKey::ANALYTICS_GA4_ID, $ga4, false, $now, $command->actorId);
        $this->settings->put(SettingKey::ANALYTICS_CLARITY_ID, $clarity, false, $now, $command->actorId);

        $this->activity->record('Settings', 'Analytics settings were changed.', ['keys' => [SettingKey::ANALYTICS_GA4_ID, SettingKey::ANALYTICS_CLARITY_ID]]);
    }
}
