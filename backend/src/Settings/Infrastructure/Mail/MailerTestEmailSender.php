<?php

namespace App\Settings\Infrastructure\Mail;

use App\Settings\Application\Port\MailNotSent;
use App\Settings\Application\Port\TestEmailSender;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\Transport\Smtp\SmtpTransport;
use Symfony\Component\Mailer\Transport\Smtp\Stream\SocketStream;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

/**
 * The test email straight to the transport every email uses (SettingsMailTransport), skipping the queue, with a short
 * socket timeout so an unreachable server answers within the request.
 */
final class MailerTestEmailSender implements TestEmailSender
{
    private const TIMEOUT_SECONDS = 15;

    public function __construct(private readonly SettingsMailTransport $transports)
    {
    }

    public function send(string $to, string $fromAddress, string $fromName): void
    {
        $transport = $this->transports->current();
        if ($transport instanceof SmtpTransport && $transport->getStream() instanceof SocketStream) {
            $transport->getStream()->setTimeout(self::TIMEOUT_SECONDS);
        }

        $email = (new Email())
            ->from(new Address($fromAddress, $fromName))
            ->to($to)
            ->subject('KF Inventory test email')
            ->text("This is a test email from KF Inventory (Settings › Email).\n\nIf you can read it, the mail server works: the order emails leave the same way.");

        try {
            $transport->send($email);
        } catch (TransportExceptionInterface $e) {
            throw new MailNotSent($e->getMessage(), 0, $e);
        }
    }
}
