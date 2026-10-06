<?php

namespace App\Settings\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/** Empty turns that tool off. */
final class AnalyticsSettingsInput
{
    #[Assert\Regex(pattern: '/^(G-[A-Z0-9]{4,12})?$/', message: 'This is not a GA4 Measurement ID (G-XXXXXXX).')]
    public ?string $ga4MeasurementId = null;

    #[Assert\Regex(pattern: '/^([a-z0-9]{6,20})?$/', message: 'This is not a Clarity Project ID.')]
    public ?string $clarityProjectId = null;
}
