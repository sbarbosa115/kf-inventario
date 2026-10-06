<?php

namespace App\Settings\Application\Command;

/** Settings › Email › "Send test email" to `$to`. */
final readonly class SendTestEmail
{
    public function __construct(
        public string $to,
        public ?int $actorId = null,
    ) {
    }
}
