<?php

namespace App\Settings\Application\Command;

use App\Settings\Application\Port\ForeignSealedSecrets;
use App\Settings\Application\Port\SecretBox;
use App\Settings\Application\Port\SecretBoxFactory;
use App\Settings\Application\Port\UnreadableSecret;
use App\Settings\Domain\Repository\SettingRepository;
use App\Shared\Application\Command\CommandHandler;
use App\Shared\Application\Port\ActivityLog;
use App\Shared\Domain\Clock;

/**
 * Key rotation (docs/pdr/prd-shops-settings.md, Security and Decisions 2): every sealed value — the encrypted settings
 * and the other contexts' (ForeignSealedSecrets) — is opened with the old key and sealed again with the current one.
 * A value the current key already opens is left alone, so a second run changes nothing. One value neither key opens
 * stops it all: the bus rolls back and nothing is half rotated.
 */
final class RekeySecretsHandler implements CommandHandler
{
    public function __construct(
        private readonly SettingRepository $settings,
        private readonly ForeignSealedSecrets $foreign,
        private readonly SecretBox $current,
        private readonly SecretBoxFactory $boxes,
        private readonly Clock $clock,
        private readonly ActivityLog $activity,
    ) {
    }

    /**
     * @throws \InvalidArgumentException the old key is not a key
     * @throws SecretsUnreadable
     */
    public function __invoke(RekeySecrets $command): RekeyedSecrets
    {
        $old = $this->boxes->withKey($command->oldHexKey);
        $now = $this->clock->now();

        $sealed = [];
        foreach ($this->settings->all() as $setting) {
            if ($setting->isEncrypted() && null !== $setting->value() && '' !== $setting->value()) {
                $sealed['app_setting.'.$setting->key()] = [$setting->value(), fn (string $v) => $this->settings->put($setting->key(), $v, true, $now)];
            }
        }
        foreach ($this->foreign->sealed() as $ref => $value) {
            $sealed[$ref] = [$value, fn (string $v) => $this->foreign->replace($ref, $v)];
        }

        $resealed = [];
        $current = 0;
        $unreadable = [];
        foreach ($sealed as $ref => [$value, $write]) {
            $plain = self::open($old, $value);
            if (null !== $plain) {
                $resealed[] = [$write, $plain, $ref];
            } elseif (null !== self::open($this->current, $value)) {
                ++$current;
            } else {
                $unreadable[] = $ref;
            }
        }
        if ([] !== $unreadable) {
            throw new SecretsUnreadable($unreadable);
        }

        foreach ($resealed as [$write, $plain]) {
            $write($this->current->seal($plain));
        }
        if ([] !== $resealed) {
            $this->activity->record('Settings', 'The stored secrets were re-sealed with a new APP_ENCRYPTION_KEY.', ['refs' => array_column($resealed, 2)]);
        }

        return new RekeyedSecrets(\count($resealed), $current);
    }

    private static function open(SecretBox $box, string $sealed): ?string
    {
        try {
            return $box->open($sealed);
        } catch (UnreadableSecret) {
            return null;
        }
    }
}
