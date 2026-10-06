<?php

namespace App\Settings\Application\Query;

use App\Settings\Domain\Model\SettingKey;

/** Settings › Analytics: Google Analytics 4 and Microsoft Clarity (no env fallback: unset is off). */
final class AnalyticsSettings
{
    public const GA4_PATTERN = '/^G-[A-Z0-9]{4,12}$/';
    public const CLARITY_PATTERN = '/^[a-z0-9]{6,20}$/';

    public function __construct(private readonly SettingValues $values)
    {
    }

    public function current(): Analytics
    {
        return new Analytics(
            $this->values->get(SettingKey::ANALYTICS_GA4_ID),
            $this->values->get(SettingKey::ANALYTICS_CLARITY_ID),
        );
    }
}
