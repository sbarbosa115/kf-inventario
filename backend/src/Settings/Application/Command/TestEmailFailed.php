<?php

namespace App\Settings\Application\Command;

use App\Shared\Domain\Error\ExternalServiceFailed;

/** The SMTP server refused the test email or could not be reached: 502 smtp_failed, its message in detail.reason. */
final class TestEmailFailed extends ExternalServiceFailed
{
    public function __construct(private readonly string $reason, ?\Throwable $previous = null)
    {
        parent::__construct('smtp_failed', 'The mail server did not take the test email.', $previous);
    }

    public function details(): array
    {
        return ['reason' => $this->reason];
    }
}
