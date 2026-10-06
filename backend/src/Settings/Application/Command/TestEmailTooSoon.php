<?php

namespace App\Settings\Application\Command;

use App\Shared\Domain\Error\TooManyAttempts;

final class TestEmailTooSoon extends TooManyAttempts
{
    public function __construct(int $seconds)
    {
        parent::__construct('test_email_too_soon', \sprintf('One test email every %d seconds: try again in a moment.', $seconds));
    }
}
