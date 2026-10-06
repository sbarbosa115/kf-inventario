<?php

namespace App\Ordering\Domain\Model;

use Doctrine\ORM\Mapping as ORM;

/**
 * The failed-deliveries inbox: a shop order the app received (webhook, pull, the legacy URL) and could not place,
 * with its body, so an admin fixes the cause and presses Retry. Placed deliveries are not stored (the order and its
 * link are the record); a refused signature keeps no body (docs/pdr/prd-shops-settings.md, Decisions 7).
 */
#[ORM\Entity]
#[ORM\Table(name: 'shop_delivery', options: ['charset' => 'utf8mb4', 'collation' => 'utf8mb4_unicode_ci'])]
#[ORM\Index(name: 'idx_shop_delivery_connection_status', columns: ['connection_id', 'status'])]
class ShopDelivery
{
    public const KIND_WEBHOOK = 'webhook';
    public const KIND_PULL = 'pull';
    public const KIND_LEGACY = 'legacy';

    public const STATUS_PLACED = 'placed';
    public const STATUS_FAILED = 'failed';
    public const STATUS_DISCARDED = 'discarded';

    public const REASON_BAD_SIGNATURE = 'bad_signature';
    public const REASON_UNKNOWN_PRODUCT = 'unknown_product';
    public const REASON_NO_WAREHOUSE = 'no_warehouse';
    public const REASON_NOT_AN_ORDER = 'not_an_order';
    public const REASON_NO_LINES = 'no_lines';
    public const REASON_DUPLICATE = 'duplicate';
    public const REASON_INACTIVE = 'inactive';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: ShopConnection::class)]
    #[ORM\JoinColumn(name: 'connection_id', nullable: true)]
    private ?ShopConnection $connection;

    #[ORM\Column(type: 'string', length: 16)]
    private string $kind;

    #[ORM\Column(type: 'string', length: 64, nullable: true)]
    private ?string $remoteOrderId;

    #[ORM\Column(type: 'string', length: 16)]
    private string $status = self::STATUS_FAILED;

    #[ORM\Column(type: 'string', length: 64, nullable: true)]
    private ?string $reasonCode;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $reason;

    /** The raw JSON body; null for a refused signature. */
    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $payload;

    #[ORM\ManyToOne(targetEntity: Order::class)]
    #[ORM\JoinColumn(name: 'order_id', nullable: true)]
    private ?Order $order = null;

    #[ORM\Column(type: 'integer')]
    private int $attempts = 1;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $receivedAt;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $lastAttemptAt;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $resolvedAt = null;

    public function __construct(?ShopConnection $connection, string $kind, ?string $remoteOrderId, string $reasonCode, ?string $reason, ?string $payload, \DateTimeImmutable $at)
    {
        $this->connection = $connection;
        $this->kind = $kind;
        $this->remoteOrderId = $remoteOrderId;
        $this->reasonCode = $reasonCode;
        $this->reason = $reason;
        $this->payload = $payload;
        $this->receivedAt = $at;
        $this->lastAttemptAt = $at;
    }

    /** A retry placed it. */
    public function placed(Order $order, \DateTimeImmutable $at): void
    {
        $this->status = self::STATUS_PLACED;
        $this->order = $order;
        ++$this->attempts;
        $this->lastAttemptAt = $at;
        $this->resolvedAt = $at;
        $this->reasonCode = null;
        $this->reason = null;
    }

    /** A retry failed again, maybe for another reason. */
    public function failedAgain(string $reasonCode, ?string $reason, \DateTimeImmutable $at): void
    {
        $this->status = self::STATUS_FAILED;
        ++$this->attempts;
        $this->lastAttemptAt = $at;
        $this->reasonCode = $reasonCode;
        $this->reason = $reason;
    }

    public function discard(\DateTimeImmutable $at): void
    {
        $this->status = self::STATUS_DISCARDED;
        $this->resolvedAt = $at;
    }

    public function id(): ?int
    {
        return $this->id;
    }

    public function connection(): ?ShopConnection
    {
        return $this->connection;
    }

    public function kind(): string
    {
        return $this->kind;
    }

    public function remoteOrderId(): ?string
    {
        return $this->remoteOrderId;
    }

    public function status(): string
    {
        return $this->status;
    }

    public function reasonCode(): ?string
    {
        return $this->reasonCode;
    }

    public function reason(): ?string
    {
        return $this->reason;
    }

    public function payload(): ?string
    {
        return $this->payload;
    }

    public function order(): ?Order
    {
        return $this->order;
    }

    public function attempts(): int
    {
        return $this->attempts;
    }

    public function receivedAt(): \DateTimeImmutable
    {
        return $this->receivedAt;
    }

    public function lastAttemptAt(): ?\DateTimeImmutable
    {
        return $this->lastAttemptAt;
    }

    public function resolvedAt(): ?\DateTimeImmutable
    {
        return $this->resolvedAt;
    }
}
