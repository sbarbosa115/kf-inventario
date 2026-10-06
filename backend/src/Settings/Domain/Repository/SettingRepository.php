<?php

namespace App\Settings\Domain\Repository;

use App\Settings\Domain\Model\AppSetting;

interface SettingRepository
{
    public function find(string $key): ?AppSetting;

    /**
     * Writes a setting (a new row or a changed one). `$value` is already sealed when `$encrypted`; null clears it.
     */
    public function put(string $key, ?string $value, bool $encrypted, \DateTimeImmutable $at, ?int $actorId = null): void;

    /**
     * @return list<AppSetting> every stored setting (the rekey command re-seals the encrypted ones)
     */
    public function all(): array;
}
