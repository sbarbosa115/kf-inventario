<?php

namespace App\Inventory\Domain\Model;

use App\Ordering\Domain\Model\Order;
use App\Repository\WarehouseRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: WarehouseRepository::class)]
#[ORM\Table(name: 'warehouse')]
class Warehouse
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private int $id;

    #[ORM\Column(type: 'string', length: 255)]
    private string $name;

    /** @var Collection<int, ProductWarehouse> */
    #[ORM\OneToMany(targetEntity: ProductWarehouse::class, mappedBy: 'warehouse')]
    private Collection $productWarehouses;

    /** @var Collection<int, Order> */
    #[ORM\OneToMany(targetEntity: Order::class, mappedBy: 'warehouse')]
    private Collection $orders;

    /** @var list<string> */
    #[ORM\Column(type: 'json')]
    private array $urls;

    /**
     * @param list<string> $urls
     */
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

    /**
     * @return Collection<int, ProductWarehouse>
     */
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
            if ($productWarehouse->getWarehouse() === $this) {
                $productWarehouse->setWarehouse(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Order>
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
            if ($order->getWarehouse() === $this) {
                $order->setWarehouse(null);
            }
        }

        return $this;
    }

    /**
     * @return list<string>
     */
    public function getUrls(): array
    {
        return $this->urls;
    }

    /**
     * @param list<string> $urls
     */
    public function setUrls(array $urls): self
    {
        $this->urls = $urls;

        return $this;
    }
}
