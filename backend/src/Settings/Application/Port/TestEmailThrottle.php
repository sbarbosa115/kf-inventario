<?php

namespace App\Settings\Application\Port;

/** One test email per window per user, so the endpoint cannot be used to send mail in bulk (Security › Access). */
interface TestEmailThrottle
{
    /** True, and the window starts, when $who sent none in the last $seconds. */
    public function allow(string $who, int $seconds): bool;
}
