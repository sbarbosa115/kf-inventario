<?php

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Doctrine\ORM\PersistentCollection;

/**
 * @ORM\Entity(repositoryClass="App\Repository\WarehouseRepository")
 */
class Warehouse
{
    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private int $id;

    /**
     * @ORM\Column(type="string", length=255)
     */
    private string $name;

    /**
     * @ORM\OneToMany(targetEntity="App\Entity\ProductWarehouse", mappedBy="warehouse")
     */
    private ArrayCollection|PersistentCollection $productWarehouses;

    /**
     * @ORM\OneToMany(targetEntity="App\Entity\Order", mappedBy="warehouse")
     */
    private ArrayCollection|PersistentCollection $orders;

    /**
     * @ORM\Column(type="array")
     */
    private array $urls;

    public function __construct(string $name, array $urls = [])
    {
        $this->productWarehouses = new ArrayCollection();
        $this->orders = new ArrayCollection();
        $this->name = $name;
        $this->urls = $urls;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function getProductWarehouses(): Collection
    {
        return $this->productWarehouses;
    }

    public function addProductWarehouse(ProductWarehouse $productWarehouse): self
    {
        if (!$this->productWarehouses->contains($productWarehouse)) {
            $this->productWarehouses[] = $productWarehouse;
            $productWarehouse->setWarehouse($this);
        }

        return $this;
    }

    public function removeProductWarehouse(ProductWarehouse $productWarehouse): self
    {
        if ($this->productWarehouses->contains($productWarehouse)) {
            $this->productWarehouses->removeElement($productWarehouse);
            // set the owning side to null (unless already changed)
            if ($productWarehouse->getWarehouse() === $this) {
                $productWarehouse->setWarehouse(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection|Order[]
     */
    public function getOrders(): Collection
    {
        return $this->orders;
    }

    public function addOrder(Order $order): self
    {
        if (!$this->orders->contains($order)) {
            $this->orders[] = $order;
            $order->setWarehouse($this);
        }

        return $this;
    }

    public function removeOrder(Order $order): self
    {
        if ($this->orders->contains($order)) {
            $this->orders->removeElement($order);
            // set the owning side to null (unless already changed)
            if ($order->getWarehouse() === $this) {
                $order->setWarehouse(null);
            }
        }

        return $this;
    }

    public function getUrls(): array
    {
        return $this->urls;
    }

    public function setUrls(array $urls): self
    {
        $this->urls = $urls;
        return $this;
    }
}
