<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * @ORM\Entity(repositoryClass="App\Repository\ProductWarehouseRepository")
 */
class ProductWarehouse
{
    public const STATUS_CONFIRMED = 1;

    public const STATUS_PENDING_TO_CONFIRM = 0;

    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    /**
     * @ORM\Column(type="integer")
     */
    private $status;

    /**
     * @ORM\Column(type="integer")
     */
    private $quantity;

    /**
     * @ORM\ManyToOne(targetEntity="App\Entity\Product", inversedBy="productWarehouses")
     */
    private $product;

    /**
     * @ORM\ManyToOne(targetEntity="App\Entity\Warehouse", inversedBy="productWarehouses")
     */
    private $warehouse;

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
