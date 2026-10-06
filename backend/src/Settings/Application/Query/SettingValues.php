<?php

namespace App\Settings\Application\Query;

use App\Settings\Application\Port\SecretBox;
use App\Settings\Application\Port\UnreadableSecret;
use App\Settings\Domain\Repository\SettingRepository;
use Psr\Log\LoggerInterface;

/**
 * Reads one setting as plain text: opened when it is sealed, null when there is no row or it is empty ("not set
 * here": the env fallback applies). A sealed value that cannot be opened (another APP_ENCRYPTION_KEY) reads as not
 * set and is logged by key, never by value.
 */
final class SettingValues
{
    public function __construct(
        private readonly SettingRepository $settings,
        private readonly SecretBox $box,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function get(string $key): ?string
    {
        $setting = $this->settings->find($key);
        $value = $setting?->value();
        if (null === $setting || null === $value || '' === $value) {
            return null;
        }
        if (!$setting->isEncrypted()) {
            return $value;
        }
        try {
            return $this->box->open($value);
        } catch (UnreadableSecret) {
            $this->logger->warning('The setting {key} cannot be opened with APP_ENCRYPTION_KEY: it reads as not set.', ['key' => $key]);

            return null;
        }
    }

    /**
     * @return list<string>
     */
    public function getList(string $key): array
    {
        $value = $this->get($key);
        $list = null === $value ? null : json_decode($value, true);

        return \is_array($list) ? array_values(array_filter(array_map(strval(...), $list), static fn (string $v): bool => '' !== $v)) : [];
    }

    public function updatedAt(string $key): ?\DateTimeImmutable
    {
        return $this->settings->find($key)?->updatedAt();
    }
}
