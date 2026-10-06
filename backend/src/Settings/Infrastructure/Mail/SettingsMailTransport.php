<?php

namespace App\Settings\Infrastructure\Mail;

use App\Settings\Application\Query\EffectiveEmail;
use App\Settings\Application\Query\EmailSettings;
use Symfony\Component\DependencyInjection\Attribute\AsDecorator;
use Symfony\Component\DependencyInjection\Attribute\AutowireDecorated;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\RawMessage;

/**
 * Every email the app sends leaves through here (it decorates Symfony's mailer.transports, which the mailer, the
 * `mail` queue's handler and the legacy pages use): through the SMTP server saved in Settings › Email when there is
 * one, else through MAILER_DSN as before (docs/pdr/prd-shops-settings.md, Decisions 1 and 3). Shared's mailer does not
 * change.
 *
 * The server is read at each send, so a change applies to the next email — the queue's worker included — without a
 * restart. A server's transport is built once per DSN and kept while the DSN stays the same.
 */
#[AsDecorator('mailer.transports')]
final class SettingsMailTransport implements TransportInterface
{
    private ?string $dsn = null;
    private ?TransportInterface $transport = null;

    public function __construct(
        #[AutowireDecorated] private readonly TransportInterface $env,
        private readonly EmailSettings $settings,
        private readonly MailTransportFactory $factory,
    ) {
    }

    public function send(RawMessage $message, ?Envelope $envelope = null): ?SentMessage
    {
        return $this->current()->send($message, $envelope);
    }

    /** The server it sends through, without the credentials ("smtp://smtp.example.com:587"). */
    public function __toString(): string
    {
        return (string) $this->current();
    }

    /** The transport of the server saved in Settings, or the env's. */
    public function current(): TransportInterface
    {
        $effective = $this->settings->effective();
        if (EffectiveEmail::SOURCE_SETTINGS !== $effective->sources['dsn'] || null === $effective->dsn) {
            return $this->env;
        }
        if ($effective->dsn !== $this->dsn || null === $this->transport) {
            $this->transport = $this->factory->fromDsn($effective->dsn);
            $this->dsn = $effective->dsn;
        }

        return $this->transport;
    }
}
