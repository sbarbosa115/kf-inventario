<?php

namespace App\Settings\Domain\Model;

use Doctrine\ORM\Mapping as ORM;

/**
 * A phrase of the comment box's phrase bar ("Customer called", "Waiting for payment"…): one tap adds it as a dated
 * comment. Ordered by `position`; hidden (not deleted) with `active` off.
 */
#[ORM\Entity]
#[ORM\Table(name: 'quick_phrase', options: ['charset' => 'utf8mb4', 'collation' => 'utf8mb4_unicode_ci'])]
class QuickPhrase
{
    public const MAX_LENGTH = 255;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 255)]
    private string $text;

    #[ORM\Column(type: 'integer')]
    private int $position;

    #[ORM\Column(type: 'boolean')]
    private bool $active;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct(string $text, int $position, \DateTimeImmutable $createdAt, bool $active = true)
    {
        $this->text = $text;
        $this->position = $position;
        $this->active = $active;
        $this->createdAt = $createdAt;
    }

    public function rename(string $text): void
    {
        $this->text = $text;
    }

    public function moveTo(int $position): void
    {
        $this->position = $position;
    }

    public function activate(bool $active): void
    {
        $this->active = $active;
    }

    public function id(): ?int
    {
        return $this->id;
    }

    public function text(): string
    {
        return $this->text;
    }

    public function position(): int
    {
        return $this->position;
    }

    public function isActive(): bool
    {
        return $this->active;
    }

    public function createdAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
