<?php

namespace App\Settings\Infrastructure\Mail;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Mailer\Transport;
use Symfony\Component\Mailer\Transport\TransportInterface;

/** The DSN through the factories Symfony builds MAILER_DSN with (smtp, smtps, and whatever bridges are installed). */
final class SymfonyMailTransportFactory implements MailTransportFactory
{
    public function __construct(#[Autowire(service: 'mailer.transport_factory')] private readonly Transport $transports)
    {
    }

    public function fromDsn(string $dsn): TransportInterface
    {
        return $this->transports->fromString($dsn);
    }
}
