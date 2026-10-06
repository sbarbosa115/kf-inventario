<?php

namespace App\Settings\Application\Command;

/** What SendTestEmail answers: the host of the server it went through ("Sent through {{host}}"). */
final readonly class SentTestEmail
{
    public function __construct(public ?string $host)
    {
    }
}
