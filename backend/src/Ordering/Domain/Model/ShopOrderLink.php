<?php

namespace App\Ordering\Domain\Model;

use Doctrine\ORM\Mapping as ORM;

/**
 * Which shop an order came from (`order.source` stays SOURCE_WEB: docs/pdr/prd-shops-settings.md, Decisions 9), the
 * shop's id for it, its status as last seen there and as last pushed by the app. One shop order is linked once.
 */
#[ORM\Entity]
#[ORM\Table(name: 'shop_order_link', options: ['charset' => 'utf8mb4', 'collation' => 'utf8mb4_unicode_ci'])]
#[ORM\UniqueConstraint(name: 'uniq_shop_order_link_remote', columns: ['connection_id', 'remote_order_id'])]
class ShopOrderLink
{
    #[ORM\Id]
    #[ORM\OneToOne(targetEntity: Order::class)]
    #[ORM\JoinColumn(name: 'order_id', nullable: false)]
    private Order $order;

    #[ORM\ManyToOne(targetEntity: ShopConnection::class)]
    #[ORM\JoinColumn(name: 'connection_id', nullable: false)]
    private ShopConnection $connection;

    #[ORM\Column(type: 'string', length: 64)]
    private string $remoteOrderId;

    #[ORM\Column(type: 'string', length: 32, nullable: true)]
    private ?string $remoteStatus;

    #[ORM\Column(type: 'string', length: 32, nullable: true)]
    private ?string $pushedStatus = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct(Order $order, ShopConnection $connection, string $remoteOrderId, ?string $remoteStatus, \DateTimeImmutable $at)
    {
        $this->order = $order;
        $this->connection = $connection;
        $this->remoteOrderId = $remoteOrderId;
        $this->remoteStatus = $remoteStatus;
        $this->createdAt = $at;
    }

    public function seenRemoteStatus(string $status): void
    {
        $this->remoteStatus = $status;
    }

    /** The status the app wrote to the shop: the same one is never pushed twice. */
    public function pushed(string $status): void
    {
        $this->pushedStatus = $status;
    }

    public function order(): Order
    {
        return $this->order;
    }

    public function connection(): ShopConnection
    {
        return $this->connection;
    }

    public function remoteOrderId(): string
    {
        return $this->remoteOrderId;
    }

    public function remoteStatus(): ?string
    {
        return $this->remoteStatus;
    }

    public function pushedStatus(): ?string
    {
        return $this->pushedStatus;
    }

    public function createdAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
