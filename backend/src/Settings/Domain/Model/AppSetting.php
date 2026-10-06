<?php

namespace App\Settings\Domain\Model;

use App\Identity\Domain\Model\User;
use Doctrine\ORM\Mapping as ORM;

/**
 * One setting the admin changed in Settings (email.dsn, analytics.ga4_id, webhooks.legacy_hits…). An empty value
 * means "not set here": the env fallback applies (docs/pdr/prd-shops-settings.md, Decisions 3). A secret is stored
 * sealed (SecretBox: "v1:" + base64(nonce‖box)) and flagged `encrypted`.
 */
#[ORM\Entity]
#[ORM\Table(name: 'app_setting', options: ['charset' => 'utf8mb4', 'collation' => 'utf8mb4_unicode_ci'])]
class AppSetting
{
    #[ORM\Id]
    #[ORM\Column(name: '`key`', type: 'string', length: 100)]
    private string $key;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $value;

    #[ORM\Column(type: 'boolean')]
    private bool $encrypted;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'updated_by_id', nullable: true)]
    private ?User $updatedBy;

    public function __construct(string $key, ?string $value, bool $encrypted, \DateTimeImmutable $at, ?User $by = null)
    {
        $this->key = $key;
        $this->value = $value;
        $this->encrypted = $encrypted;
        $this->updatedAt = $at;
        $this->updatedBy = $by;
    }

    /** A new value (already sealed when `encrypted`); null clears it. */
    public function change(?string $value, bool $encrypted, \DateTimeImmutable $at, ?User $by = null): void
    {
        $this->value = $value;
        $this->encrypted = $encrypted;
        $this->updatedAt = $at;
        $this->updatedBy = $by;
    }

    public function key(): string
    {
        return $this->key;
    }

    public function value(): ?string
    {
        return $this->value;
    }

    public function isEncrypted(): bool
    {
        return $this->encrypted;
    }

    public function updatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function updatedBy(): ?User
    {
        return $this->updatedBy;
    }
}
