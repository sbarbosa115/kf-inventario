<?php

namespace App\Ordering\Domain\Model;

use App\Identity\Domain\Model\User;
use Doctrine\ORM\Mapping as ORM;

/**
 * What the production `comment` table cannot hold: where a comment came from (the app, a quick phrase, a shop note
 * — a `comment` row with no user), whether it is the order's pinned one, the shop note's id (pulls stay idempotent)
 * and whether it was sent to the shop (docs/pdr/prd-shops-settings.md, Decisions 14). A comment without a meta row
 * is an `app` comment that is not pinned.
 */
#[ORM\Entity]
#[ORM\Table(name: 'order_comment_meta', options: ['charset' => 'utf8mb4', 'collation' => 'utf8mb4_unicode_ci'])]
#[ORM\UniqueConstraint(name: 'uniq_order_comment_meta_note', columns: ['connection_id', 'remote_note_id'])]
class OrderCommentMeta
{
    public const ORIGIN_APP = 'app';
    public const ORIGIN_SHOP = 'shop';
    public const ORIGIN_PHRASE = 'phrase';

    #[ORM\Id]
    #[ORM\OneToOne(targetEntity: Comment::class)]
    #[ORM\JoinColumn(name: 'comment_id', onDelete: 'CASCADE')]
    private Comment $comment;

    #[ORM\Column(type: 'string', length: 16)]
    private string $origin;

    #[ORM\Column(type: 'boolean')]
    private bool $pinned = false;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $pinnedAt = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'pinned_by_id', nullable: true)]
    private ?User $pinnedBy = null;

    #[ORM\ManyToOne(targetEntity: ShopConnection::class)]
    #[ORM\JoinColumn(name: 'connection_id', nullable: true)]
    private ?ShopConnection $connection;

    #[ORM\Column(type: 'string', length: 64, nullable: true)]
    private ?string $remoteNoteId;

    #[ORM\Column(type: 'boolean')]
    private bool $sendToShop;

    public function __construct(Comment $comment, string $origin, ?ShopConnection $connection = null, ?string $remoteNoteId = null, bool $sendToShop = false)
    {
        $this->comment = $comment;
        $this->origin = $origin;
        $this->connection = $connection;
        $this->remoteNoteId = $remoteNoteId;
        $this->sendToShop = $sendToShop;
    }

    public function pin(\DateTimeImmutable $at, ?User $by): void
    {
        $this->pinned = true;
        $this->pinnedAt = $at;
        $this->pinnedBy = $by;
    }

    public function unpin(): void
    {
        $this->pinned = false;
        $this->pinnedAt = null;
        $this->pinnedBy = null;
    }

    public function comment(): Comment
    {
        return $this->comment;
    }

    public function origin(): string
    {
        return $this->origin;
    }

    public function isPinned(): bool
    {
        return $this->pinned;
    }

    public function pinnedAt(): ?\DateTimeImmutable
    {
        return $this->pinnedAt;
    }

    public function pinnedBy(): ?User
    {
        return $this->pinnedBy;
    }

    public function connection(): ?ShopConnection
    {
        return $this->connection;
    }

    public function remoteNoteId(): ?string
    {
        return $this->remoteNoteId;
    }

    public function sendsToShop(): bool
    {
        return $this->sendToShop;
    }
}
