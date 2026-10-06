<?php

namespace App\Tests\Functional\Settings;

use App\Settings\Infrastructure\Mail\MailTransportFactory;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\RawMessage;

/**
 * Stands in for the SMTP servers a test saves in Settings › Email: it records which DSN each email went through
 * instead of opening a socket, and a host named in `$failing` answers the way a refusing server does.
 */
final class SpyMailTransports implements MailTransportFactory
{
    /** @var list<array{dsn: string, message: RawMessage}> */
    public array $sent = [];

    /** @var list<string> the DSNs a transport was built for */
    public array $built = [];

    /**
     * @param array<string, string> $failing host => the server's message
     */
    public function __construct(private readonly array $failing = [])
    {
    }

    public function fromDsn(string $dsn): TransportInterface
    {
        $this->built[] = $dsn;
        $host = (string) parse_url($dsn, \PHP_URL_HOST);
        $spy = $this;

        return new class($dsn, $this->failing[$host] ?? null, $spy) implements TransportInterface {
            public function __construct(private readonly string $dsn, private readonly ?string $failure, private readonly SpyMailTransports $spy)
            {
            }

            public function send(RawMessage $message, ?Envelope $envelope = null): ?SentMessage
            {
                if (null !== $this->failure) {
                    throw new TransportException($this->failure);
                }
                $this->spy->sent[] = ['dsn' => $this->dsn, 'message' => $message];

                return new SentMessage($message, $envelope ?? Envelope::create($message));
            }

            public function __toString(): string
            {
                return 'spy://'.parse_url($this->dsn, \PHP_URL_HOST);
            }
        };
    }

    /** The host of each email that went through a Settings server, in order. */
    public function hosts(): array
    {
        return array_map(static fn (array $s): string => (string) parse_url($s['dsn'], \PHP_URL_HOST), $this->sent);
    }
}
