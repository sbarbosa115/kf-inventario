<?php

namespace App\Ordering\Domain\Model;

use Doctrine\ORM\Mapping as ORM;

/**
 * What the app wants to write to a shop (an order's status, an order note). The Messenger message carries only this
 * row's id; the pusher sends it, retries it (1, 5, 25 min) and marks it `failed` after the last try, shown in the
 * connection's health with Retry (docs/pdr/prd-shops-settings.md, Decisions 10).
 */
#[ORM\Entity]
#[ORM\Table(name: 'shop_outbox', options: ['charset' => 'utf8mb4', 'collation' => 'utf8mb4_unicode_ci'])]
#[ORM\Index(name: 'idx_shop_outbox_status_next', columns: ['status', 'next_attempt_at'])]
class ShopOutbox
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_SENT = 'sent';
    public const STATUS_FAILED = 'failed';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: ShopConnection::class)]
    #[ORM\JoinColumn(name: 'connection_id', nullable: false)]
    private ShopConnection $connection;

    #[ORM\ManyToOne(targetEntity: Order::class)]
    #[ORM\JoinColumn(name: 'order_id', nullable: false)]
    private Order $order;

    #[ORM\Column(type: 'string', length: 32)]
    private string $capability;

    /** @var array<string, mixed> */
    #[ORM\Column(type: 'json')]
    private array $payload;

    #[ORM\Column(type: 'string', length: 16)]
    private string $status = self::STATUS_PENDING;

    #[ORM\Column(type: 'integer')]
    private int $attempts = 0;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $nextAttemptAt;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $lastError = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $sentAt = null;

    /**
     * @param array<string, mixed> $payload
     */
    public function __construct(ShopConnection $connection, Order $order, ShopCapability $capability, array $payload, \DateTimeImmutable $at)
    {
        $this->connection = $connection;
        $this->order = $order;
        $this->capability = $capability->value;
        $this->payload = $payload;
        $this->createdAt = $at;
        $this->nextAttemptAt = $at;
    }

    public function sent(\DateTimeImmutable $at): void
    {
        $this->status = self::STATUS_SENT;
        ++$this->attempts;
        $this->sentAt = $at;
        $this->nextAttemptAt = null;
        $this->lastError = null;
    }

    /** One try failed: another one at $next, or none ($next null): the row is `failed` until someone retries it. */
    public function attemptFailed(string $error, \DateTimeImmutable $at, ?\DateTimeImmutable $next): void
    {
        ++$this->attempts;
        $this->lastError = $error;
        $this->nextAttemptAt = $next;
        $this->status = null === $next ? self::STATUS_FAILED : self::STATUS_PENDING;
    }

    /** Retry from the health panel: pending again, now. */
    public function requeue(\DateTimeImmutable $at): void
    {
        $this->status = self::STATUS_PENDING;
        $this->nextAttemptAt = $at;
    }

    public function id(): ?int
    {
        return $this->id;
    }

    public function connection(): ShopConnection
    {
        return $this->connection;
    }

    public function order(): Order
    {
        return $this->order;
    }

    public function capability(): ShopCapability
    {
        return ShopCapability::from($this->capability);
    }

    /** @return array<string, mixed> */
    public function payload(): array
    {
        return $this->payload;
    }

    public function status(): string
    {
        return $this->status;
    }

    public function attempts(): int
    {
        return $this->attempts;
    }

    public function nextAttemptAt(): ?\DateTimeImmutable
    {
        return $this->nextAttemptAt;
    }

    public function lastError(): ?string
    {
        return $this->lastError;
    }

    public function createdAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function sentAt(): ?\DateTimeImmutable
    {
        return $this->sentAt;
    }
}
