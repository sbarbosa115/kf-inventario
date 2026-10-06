<?php

namespace App\Settings\Application\Command;

/**
 * Settings › Email as the form sends it. A blank password keeps the stored one; every field empty clears the
 * settings, so the env applies again (Decisions 3).
 */
final readonly class SaveEmailSettings
{
    /**
     * @param list<string> $cc
     */
    public function __construct(
        public ?string $host,
        public ?int $port,
        public ?string $user,
        public ?string $password,
        public string $encryption,
        public ?string $fromAddress,
        public ?string $fromName,
        public ?string $printerAddress,
        public array $cc,
        public ?int $actorId = null,
    ) {
    }
}
