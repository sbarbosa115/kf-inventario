<?php

namespace App\Settings\Application\Command;

/** Settings › Analytics; an empty id turns that tool off. */
final readonly class SaveAnalyticsSettings
{
    public function __construct(
        public ?string $ga4MeasurementId,
        public ?string $clarityProjectId,
        public ?int $actorId = null,
    ) {
    }
}
