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
 * the printer and the cc list. An empty host clears the server (MAILER_DSN applies again). Logged by key, not value.
 */
final class SaveEmailSettingsHandler implements CommandHandler
{
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
        if (!\in_array($command->encryption, SmtpServer::ENCRYPTIONS, true)) {
            throw new InvalidSetting('encryption', 'The encryption must be tls, ssl or none.');
        }
        $now = $this->clock->now();
        $host = self::blankToNull($command->host);

        $dsn = null;
        if (null !== $host) {
            $password = self::blankToNull($command->password);
            if (null === $password) {
                $stored = $this->values->get(SettingKey::EMAIL_DSN);
                $password = null === $stored ? null : SmtpServer::fromDsn($stored)?->password;
            }
            $dsn = $this->box->seal((new SmtpServer($host, $command->port, self::blankToNull($command->user), $password, $command->encryption))->dsn());
        }
        $this->settings->put(SettingKey::EMAIL_DSN, $dsn, true, $now, $command->actorId);
        $this->settings->put(SettingKey::EMAIL_FROM_ADDRESS, self::blankToNull($command->fromAddress), false, $now, $command->actorId);
        $this->settings->put(SettingKey::EMAIL_FROM_NAME, self::blankToNull($command->fromName), false, $now, $command->actorId);
        $this->settings->put(SettingKey::EMAIL_PRINTER_ADDRESS, self::blankToNull($command->printerAddress), false, $now, $command->actorId);
        $cc = array_values(array_filter(array_map('trim', $command->cc), static fn (string $a): bool => '' !== $a));
        $this->settings->put(SettingKey::EMAIL_CC, [] === $cc ? null : json_encode($cc, \JSON_THROW_ON_ERROR), false, $now, $command->actorId);

        $this->activity->record('Settings', 'Email settings were changed.', ['keys' => [SettingKey::EMAIL_DSN, SettingKey::EMAIL_FROM_ADDRESS, SettingKey::EMAIL_FROM_NAME, SettingKey::EMAIL_PRINTER_ADDRESS, SettingKey::EMAIL_CC]]);
    }

    private static function blankToNull(?string $value): ?string
    {
        $value = null === $value ? null : trim($value);

        return '' === $value ? null : $value;
    }
}
