<?php

namespace App\Entity;

use App\Repository\ProductWarehouseRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: ProductWarehouseRepository::class)]
class ProductWarehouse
{
    public const STATUS_CONFIRMED = 1;
    public const STATUS_PENDING_TO_CONFIRM = 0;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(type: 'integer')]
    private ?int $status = null;

    #[ORM\Column(type: 'integer')]
    private ?int $quantity = null;

    #[ORM\ManyToOne(targetEntity: Product::class, inversedBy: 'productWarehouses')]
    private ?Product $product = null;

    #[ORM\ManyToOne(targetEntity: Warehouse::class, inversedBy: 'productWarehouses')]
    private ?Warehouse $warehouse = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getStatus(): ?int
    {
        return $this->status;
    }

    public function setStatus(int $status): self
    {
        $this->status = $status;

        return $this;
    }

    public function getQuantity(): ?int
    {
        return $this->quantity;
    }

    public function setQuantity(int $quantity): self
    {
        $this->quantity = $quantity;

        return $this;
    }

    public function getProduct(): ?Product
    {
        return $this->product;
    }

    public function setProduct(?Product $product): self
    {
        $this->product = $product;

        return $this;
    }

    public function getWarehouse(): ?Warehouse
    {
        return $this->warehouse;
    }

    public function setWarehouse(?Warehouse $warehouse): self
    {
        $this->warehouse = $warehouse;

        return $this;
    }

    public function addQuantity(?int $quantity): void
    {
        if (null === $quantity) {
            $quantity = 0;
        }
        $this->quantity += $quantity;
    }

    public function subQuantity(int $quantity): void
    {
        if ($quantity > $this->quantity) {
            throw new \InvalidArgumentException(
                'The quantity to subtraction should be less than the product one.'
            );
        }
        $this->quantity -= $quantity;
    }
}
