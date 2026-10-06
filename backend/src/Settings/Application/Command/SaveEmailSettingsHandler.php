<?php

namespace App\Settings\Application\Command;

use App\Settings\Application\Port\SecretBox;
use App\Settings\Application\Query\SettingValues;
use App\Settings\Domain\Error\InvalidSetting;
use App\Settings\Domain\Model\SettingKey;
use App\Settings\Domain\Model\SmtpServer;
use App\Settings\Domain\Repository\SettingRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;
use App\Shared\Domain\Clock;

/**
 * Writes Settings › Email: the SMTP server as one sealed DSN (the password inside it never leaves sealed), the sender,
 * the printer and the cc list. An empty host clears the server (MAILER_DSN applies again). Logged by key, not value,
 * and only the keys that changed.
 *
 * The shapes are checked here too, not only on the Input DTO: the host goes into a DSN, so it is a host name or an IP
 * and nothing else (no scheme, credentials, port, path or query slipped in). A blank password keeps the saved one only
 * for the same host: the saved password never leaves for a server nobody typed it for.
 */
final class SaveEmailSettingsHandler implements CommandHandler
{
    private const HOST_PATTERN = '/^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*|\[[0-9A-Fa-f:.]+\])$/';

    public function __construct(
        private readonly SettingRepository $settings,
        private readonly SettingValues $values,
        private readonly SecretBox $box,
        private readonly Clock $clock,
        private readonly ActivityLog $activity,
    ) {
    }

    public function __invoke(SaveEmailSettings $command): void
    {
        $values = [
            SettingKey::EMAIL_DSN => $this->dsn($command),
            SettingKey::EMAIL_FROM_ADDRESS => self::address('from_address', $command->fromAddress),
            SettingKey::EMAIL_FROM_NAME => self::blankToNull($command->fromName),
            SettingKey::EMAIL_PRINTER_ADDRESS => self::address('printer_address', $command->printerAddress),
            SettingKey::EMAIL_CC => $this->cc($command->cc),
        ];

        $now = $this->clock->now();
        $changed = [];
        foreach ($values as $key => $value) {
            if ($this->values->get($key) === $value) {
                continue;
            }
            $sealed = SettingKey::EMAIL_DSN === $key;
            $this->settings->put($key, $sealed && null !== $value ? $this->box->seal($value) : $value, $sealed, $now, $command->actorId);
            $changed[] = $key;
        }

        if ([] !== $changed) {
            $this->activity->record('Settings', 'Email settings were changed.', ['keys' => $changed]);
        }
    }

    /** The plain DSN to store sealed, or null to clear the server. */
    private function dsn(SaveEmailSettings $command): ?string
    {
        $host = self::blankToNull($command->host);
        if (null === $host) {
            return null;
        }
        if (1 !== preg_match(self::HOST_PATTERN, $host) || \strlen($host) > 253) {
            throw new InvalidSetting('host', 'Type the server\'s host name only (smtp.example.com), without smtp://, a port or a user.');
        }
        if (null !== $command->port && ($command->port < 1 || $command->port > 65535)) {
            throw new InvalidSetting('port', 'The port is a number from 1 to 65535.');
        }
        if (!\in_array($command->encryption, SmtpServer::ENCRYPTIONS, true)) {
            throw new InvalidSetting('encryption', 'The encryption must be tls, ssl or none.');
        }

        $password = self::blankToNull($command->password);
        if (null === $password) {
            $stored = $this->values->get(SettingKey::EMAIL_DSN);
            $saved = null === $stored ? null : SmtpServer::fromDsn($stored);
            $password = null !== $saved && 0 === strcasecmp($saved->host, $host) ? $saved->password : null;
        }

        return (new SmtpServer($host, $command->port, self::blankToNull($command->user), $password, $command->encryption))->dsn();
    }

    /**
     * @param list<string> $cc
     */
    private function cc(array $cc): ?string
    {
        $list = [];
        foreach ($cc as $i => $address) {
            $address = self::address("cc[{$i}]", $address);
            if (null !== $address) {
                $list[] = $address;
            }
        }

        return [] === $list ? null : json_encode(array_values(array_unique($list)), \JSON_THROW_ON_ERROR);
    }

    private static function address(string $field, ?string $value): ?string
    {
        $value = self::blankToNull($value);
        if (null !== $value && false === filter_var($value, \FILTER_VALIDATE_EMAIL)) {
            throw new InvalidSetting($field, 'This value is not a valid email address.');
        }

        return $value;
    }

    private static function blankToNull(?string $value): ?string
    {
        $value = null === $value ? null : trim($value);

        return '' === $value ? null : $value;
    }
}
