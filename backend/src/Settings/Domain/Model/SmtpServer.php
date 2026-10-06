<?php

namespace App\Settings\Domain\Model;

/**
 * The SMTP server of Settings › Email as its parts, and as the mailer DSN it is stored as (sealed: it holds the
 * password). `tls`: smtp:// (STARTTLS when the server offers it, implicit TLS on 465); `ssl`: smtps://; `none`:
 * smtp:// without TLS.
 */
final readonly class SmtpServer
{
    public const ENCRYPTIONS = ['tls', 'ssl', 'none'];

    public function __construct(
        public string $host,
        public ?int $port,
        public ?string $user,
        public ?string $password,
        public string $encryption = 'tls',
    ) {
    }

    /** The parts of a stored DSN; null when it is not an SMTP DSN (null://, sendmail://…). */
    public static function fromDsn(string $dsn): ?self
    {
        $parts = parse_url($dsn);
        if (false === $parts || !isset($parts['scheme'], $parts['host']) || !\in_array($parts['scheme'], ['smtp', 'smtps'], true)) {
            return null;
        }
        parse_str($parts['query'] ?? '', $query);
        $encryption = 'smtps' === $parts['scheme'] ? 'ssl' : ('false' === ($query['auto_tls'] ?? null) ? 'none' : 'tls');

        return new self(
            $parts['host'],
            $parts['port'] ?? null,
            isset($parts['user']) ? rawurldecode($parts['user']) : null,
            isset($parts['pass']) ? rawurldecode($parts['pass']) : null,
            $encryption,
        );
    }

    public function dsn(): string
    {
        $auth = '';
        if (null !== $this->user && '' !== $this->user) {
            $auth = rawurlencode($this->user);
            if (null !== $this->password && '' !== $this->password) {
                $auth .= ':'.rawurlencode($this->password);
            }
            $auth .= '@';
        }
        $port = null === $this->port ? '' : ':'.$this->port;

        return match ($this->encryption) {
            'ssl' => "smtps://{$auth}{$this->host}{$port}",
            'none' => "smtp://{$auth}{$this->host}{$port}?auto_tls=false",
            default => "smtp://{$auth}{$this->host}{$port}",
        };
    }

    public function withPassword(?string $password): self
    {
        return new self($this->host, $this->port, $this->user, $password, $this->encryption);
    }
}
