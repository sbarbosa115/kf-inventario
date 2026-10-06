<?php

namespace App\Settings\UI\Http\Output;

/**
 * Settings › Email as the form shows it. Never the password or the raw DSN: `has_password` says whether one is
 * saved. The values are what Settings holds (null: not set here, the env applies); `source` says where each
 * effective value comes from, `env_host` the env server's host.
 */
final readonly class EmailSettingsOutput
{
    /**
     * @param list<string> $cc
     */
    public function __construct(
        public ?string $dsnHost,
        public ?int $dsnPort,
        public ?string $dsnUser,
        public bool $hasPassword,
        /** tls, ssl or none */
        public string $encryption,
        public ?string $fromAddress,
        public ?string $fromName,
        public ?string $printerAddress,
        public array $cc,
        public EmailSourcesOutput $source,
        public ?string $envHost,
    ) {
    }
}
