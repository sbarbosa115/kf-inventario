<?php

namespace App\Settings\Application\Query;

use App\Settings\Domain\Model\SettingKey;
use App\Settings\Domain\Model\SmtpServer;

/**
 * Settings › Email with the env fallback (docs/pdr/prd-shops-settings.md, Decisions 3): a setting row wins when it
 * holds a value; empty → env (MAILER_DSN, MAILER_FROM_*, MAILER_PRINTER_ADDRESS, the ordering.order_email.cc
 * parameter) → not configured.
 */
final class EmailSettings
{
    /**
     * @param list<string> $envCc
     */
    public function __construct(
        private readonly SettingValues $values,
        private readonly string $envDsn,
        private readonly string $envFromAddress,
        private readonly string $envFromName,
        private readonly string $envPrinterAddress,
        private readonly array $envCc,
    ) {
    }

    public function effective(): EffectiveEmail
    {
        $dsn = $this->values->get(SettingKey::EMAIL_DSN);
        $fromAddress = $this->values->get(SettingKey::EMAIL_FROM_ADDRESS);
        $fromName = $this->values->get(SettingKey::EMAIL_FROM_NAME);
        $printer = $this->values->get(SettingKey::EMAIL_PRINTER_ADDRESS);
        $cc = $this->values->getList(SettingKey::EMAIL_CC);
        $fromInSettings = null !== $fromAddress || null !== $fromName;

        return new EffectiveEmail(
            dsn: $dsn ?? ('' === $this->envDsn ? null : $this->envDsn),
            // Each half of the sender falls back on its own: an address saved without a name keeps the env's name
            // (taking both from Settings, the order email was not built at all for want of a name).
            fromAddress: $fromAddress ?? $this->envFromAddress,
            fromName: $fromName ?? $this->envFromName,
            printerAddress: $printer ?? $this->envPrinterAddress,
            cc: [] !== $cc ? $cc : $this->envCc,
            sources: [
                'dsn' => self::source(null !== $dsn, '' !== $this->envDsn),
                'from' => self::source($fromInSettings, '' !== $this->envFromAddress),
                'printer' => self::source(null !== $printer, '' !== $this->envPrinterAddress),
                'cc' => self::source([] !== $cc, [] !== $this->envCc),
            ],
        );
    }

    public function stored(): StoredEmail
    {
        $dsn = $this->values->get(SettingKey::EMAIL_DSN);
        $server = null === $dsn ? null : SmtpServer::fromDsn($dsn);
        $envHost = '' === $this->envDsn ? null : parse_url($this->envDsn, \PHP_URL_HOST);

        return new StoredEmail(
            host: $server?->host,
            port: $server?->port,
            user: $server?->user,
            hasPassword: null !== $server?->password && '' !== $server->password,
            encryption: $server->encryption ?? 'tls',
            fromAddress: $this->values->get(SettingKey::EMAIL_FROM_ADDRESS),
            fromName: $this->values->get(SettingKey::EMAIL_FROM_NAME),
            printerAddress: $this->values->get(SettingKey::EMAIL_PRINTER_ADDRESS),
            cc: $this->values->getList(SettingKey::EMAIL_CC),
            sources: $this->effective()->sources,
            envHost: \is_string($envHost) && '' !== $envHost ? $envHost : null,
        );
    }

    private static function source(bool $inSettings, bool $inEnv): string
    {
        return $inSettings ? EffectiveEmail::SOURCE_SETTINGS : ($inEnv ? EffectiveEmail::SOURCE_ENV : EffectiveEmail::SOURCE_NONE);
    }
}
