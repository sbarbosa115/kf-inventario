<?php

namespace App\Settings\UI\Http\Output;

final readonly class AnalyticsSettingsOutput
{
    public function __construct(
        /** G-XXXXXXX, from GA4 › Admin › Data streams */
        public ?string $ga4MeasurementId,
        /** Clarity › Settings › Project ID */
        public ?string $clarityProjectId,
    ) {
    }
}
