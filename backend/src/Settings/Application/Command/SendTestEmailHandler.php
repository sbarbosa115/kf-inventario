<?php

namespace App\Settings\Application\Command;

use App\Settings\Application\Port\MailNotSent;
use App\Settings\Application\Port\TestEmailSender;
use App\Settings\Application\Port\TestEmailThrottle;
use App\Settings\Application\Query\EmailSettings;
use App\Settings\Domain\Error\InvalidSetting;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;

/**
 * "Send test email" (docs/pdr/prd-shops-settings.md, "API changes" › Settings): from the effective sender, through the
 * effective server, at once. The server's refusal is the answer (502 smtp_failed with its message); one per 10 s per
 * user (429).
 */
final class SendTestEmailHandler implements CommandHandler
{
    public const WINDOW_SECONDS = 10;

    public function __construct(
        private readonly EmailSettings $settings,
        private readonly TestEmailSender $sender,
        private readonly TestEmailThrottle $throttle,
        private readonly ActivityLog $activity,
    ) {
    }

    /**
     * @throws TestEmailTooSoon
     * @throws TestEmailFailed
     */
    public function __invoke(SendTestEmail $command): SentTestEmail
    {
        if (!$this->throttle->allow('user-'.($command->actorId ?? 0), self::WINDOW_SECONDS)) {
            throw new TestEmailTooSoon(self::WINDOW_SECONDS);
        }
        $email = $this->settings->effective();
        if ('' === $email->fromAddress) {
            throw new InvalidSetting('from_address', 'Set the sender address first: the email needs a From.');
        }
        $host = null === $email->dsn ? null : parse_url($email->dsn, \PHP_URL_HOST);
        $host = \is_string($host) && '' !== $host ? $host : null;

        try {
            $this->sender->send($command->to, $email->fromAddress, $email->fromName);
        } catch (MailNotSent $e) {
            throw new TestEmailFailed($e->getMessage(), $e);
        }

        $this->activity->record('Settings', 'A test email was sent.', ['host' => $host, 'source' => $email->sources['dsn']]);

        return new SentTestEmail($host);
    }
}
