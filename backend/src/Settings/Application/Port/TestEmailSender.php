<?php

namespace App\Settings\Application\Port;

/**
 * Sends "Send test email" at once through the effective server (Settings › Email, else MAILER_DSN) — not through the
 * queue — so the admin reads the SMTP server's own answer.
 */
interface TestEmailSender
{
    /**
     * @throws MailNotSent the server refused it or could not be reached
     */
    public function send(string $to, string $fromAddress, string $fromName): void;
}
