<?php

namespace App\Settings\Infrastructure\Mail;

use Symfony\Component\Mailer\Transport\TransportInterface;

/** Builds the mailer transport of a DSN saved in Settings › Email (tests swap in a spy that opens no socket). */
interface MailTransportFactory
{
    public function fromDsn(string $dsn): TransportInterface;
}
