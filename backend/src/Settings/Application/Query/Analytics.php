<?php

namespace App\Settings\Application\Query;

/** The analytics IDs every signed-in page loads (null: that tool is off). */
final readonly class Analytics
{
    public function __construct(
        public ?string $ga4MeasurementId,
        public ?string $clarityProjectId,
    ) {
    }
}
