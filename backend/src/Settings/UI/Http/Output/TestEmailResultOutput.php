<?php

namespace App\Settings\UI\Http\Output;

/** "Send test email" went out (synchronously, through the effective server). */
final readonly class TestEmailResultOutput
{
    public function __construct(
        public bool $queued,
        /** The SMTP host it went through */
        public ?string $host,
    ) {
    }
}
