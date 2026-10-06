<?php

namespace App\Settings\UI\Http\Output;

/** What every signed-in page reads: the analytics IDs to load (null: that tool is off). */
final readonly class PublicSettingsOutput
{
    public function __construct(
        public ?string $ga4MeasurementId,
        public ?string $clarityProjectId,
    ) {
    }
}
