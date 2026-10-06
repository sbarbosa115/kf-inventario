<?php

namespace App\Settings\Application\Query;

/**
 * Settings › Email as the form shows it: what is saved in Settings (never the password: only whether there is one),
 * the sources of the effective values, and the env server's host for "when empty, MAILER_DSN is used".
 */
final readonly class StoredEmail
{
    /**
     * @param list<string>                                                  $cc
     * @param array{dsn: string, from: string, printer: string, cc: string} $sources
     */
    public function __construct(
        public ?string $host,
        public ?int $port,
        public ?string $user,
        public bool $hasPassword,
        public string $encryption,
        public ?string $fromAddress,
        public ?string $fromName,
        public ?string $printerAddress,
        public array $cc,
        public array $sources,
        public ?string $envHost,
    ) {
    }
}
