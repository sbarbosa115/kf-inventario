<?php

namespace App\Entity;

use DateTime;
use DateTimeInterface;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Exception;
use Gedmo\Mapping\Annotation as Gedmo;
use InvalidArgumentException;

/**
 * @ORM\Entity(repositoryClass="App\Repository\OrderRepository")
 * @ORM\Table(name="`order`")
 * @Gedmo\SoftDeleteable(fieldName="deletedAt", timeAware=false, hardDelete=true)
 */
class Order
{
    public const SOURCE_WEB = 1;
    public const SOURCE_PHONE = 2;

    //Created
    public const STATUS_CREATED = 1;
    //Processing
    public const STATUS_PROCESSED = 2;
    //Processed
    public const STATUS_COMPLETED = 3;
    public const STATUS_PARTIAL = 4;
    public const STATUS_SENT = 5;
    public const STATUS_DELIVERED = 6;

    public const PAYMENT_CREDIT_CARD = 1;
    public const PAYMENT_PAYPAL = 2;

    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    /**
     * @ORM\Column(type="string", length=255, nullable=true)
     */
    private $code;

    /**
     * @ORM\ManyToOne(targetEntity="App\Entity\Customer", inversedBy="request")
     * @ORM\JoinColumn(nullable=true)
     */
    private $customer;

    /**
     * @ORM\OneToMany(targetEntity="App\Entity\Comment", mappedBy="order")
     */
    private $comments;

    /**
     * @ORM\ManyToOne(targetEntity="App\Entity\Warehouse", inversedBy="orders")
     * @ORM\JoinColumn(nullable=true)
     */
    private $warehouse;

    /**
     * @ORM\Column(type="integer", nullable=true)
     */
    private $source;

    /**
     * @ORM\Column(type="integer", nullable=true)
     */
    private $status;

    /**
     * @ORM\Column(type="datetime", nullable=true)
     */
    private $deletedAt;

    /**
     * @ORM\Column(type="datetime", nullable=true)
     */
    private $createdAt;

    /**
     * @ORM\Column(type="datetime", nullable=true)
     */
    private $modifiedAt;

    /**
     * @ORM\OneToMany(targetEntity="App\Entity\OrderProduct", mappedBy="order", cascade={"persist", "remove"})
     */
    private $orderProduct;

    /**
     * @ORM\Column(type="text", nullable=true)
     */
    private $comment;

    /**
     * @ORM\Column(type="integer", nullable=true)
     */
    private $paymentMethod;

    /**
     * @ORM\OneToMany(targetEntity="App\Entity\OrderStatus", mappedBy="order", cascade={"persist"})
     */
    private $orderStatuses;

    /**
     * @ORM\ManyToOne(targetEntity="App\Entity\Order", cascade={"persist"})
     */
    private $parent;

    /**
     * @ORM\OneToMany(targetEntity="App\Entity\Order", mappedBy="parent")
     */
    private $children;

    /**
     * @throws Exception
     */
    public function __construct()
    {
        if (null === $this->getCreatedAt()) {
            $this->setCreatedAt(new DateTime());
        }
        $this->comments = new ArrayCollection();
        $this->orderProduct = new ArrayCollection();
        $this->orderStatuses = new ArrayCollection();
        $this->children = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCode(): ?string
    {
        return $this->code;
    }

    public function setCode(string $code): self
    {
        $this->code = $code;

        return $this;
    }

    public function getCustomer(): ?Customer
    {
        return $this->customer;
    }

    public function setCustomer(?Customer $customer): self
    {
        $this->customer = $customer;

        return $this;
    }

    /**
     * @return Collection|Comment[]
     */
    public function getComments(): Collection
    {
        return $this->comments;
    }

    public function addComment(Comment $comment): self
    {
        if (!$this->comments->contains($comment)) {
            $this->comments[] = $comment;
            $comment->setOrder($this);
        }

        return $this;
    }

    public function removeComment(Comment $comment): self
    {
        if ($this->comments->contains($comment)) {
            $this->comments->removeElement($comment);
            // set the owning side to null (unless already changed)
            if ($comment->getOrder() === $this) {
                $comment->setOrder(null);
            }
        }

        return $this;
    }

    public function getOrderProducts(): Collection
    {
        return $this->orderProduct;
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

    public function getSource(): ?int
    {
        return $this->source;
    }

    public function setSource(int $source): self
    {
        $this->source = $source;

        return $this;
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

    public function getDeletedAt(): ?DateTimeInterface
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?DateTimeInterface $deletedAt): self
    {
        $this->deletedAt = $deletedAt;

        return $this;
    }

    public function getCreatedAt(): ?DateTimeInterface
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTimeInterface $createdAt): self
    {
        $this->createdAt = $createdAt;

        return $this;
    }

    public function getModifiedAt(): ?DateTimeInterface
    {
        return $this->modifiedAt;
    }

    public function setModifiedAt(?DateTimeInterface $modifiedAt): self
    {
        $this->modifiedAt = $modifiedAt;

        return $this;
    }

    /**
     * @ORM\PrePersist()
     * @ORM\PreUpdate()
     */
    public function updateModifiedDatetime(): void
    {
        $this->setModifiedAt(new DateTime());
    }

    public function getCreatedAtAsString(): string
    {
        if (!$this->getCreatedAt() instanceof DateTime) {
            throw new InvalidArgumentException('Datetime on order is mandatory.');
        }

        return $this->getCreatedAt()->format('Y-m-d H:i:s');
    }

    public function getComment(): ?string
    {
        return $this->comment;
    }

    public function setComment(?string $comment): self
    {
        $this->comment = $comment;

        return $this;
    }

    public function getPaymentMethod(): ?int
    {
        return $this->paymentMethod;
    }

    public function setPaymentMethod(?int $paymentMethod): self
    {
        $this->paymentMethod = $paymentMethod;

        return $this;
    }

    /**
     * @return Collection|OrderStatus[]
     */
    public function getOrderStatuses(): Collection
    {
        return $this->orderStatuses;
    }

    public function addOrderStatus(OrderStatus $orderStatus): self
    {
        if (!$this->orderStatuses->contains($orderStatus)) {
            $this->orderStatuses[] = $orderStatus;
            $orderStatus->setOrder($this);
        }

        return $this;
    }

    public function removeOrderStatus(OrderStatus $orderStatus): self
    {
        if ($this->orderStatuses->contains($orderStatus)) {
            $this->orderStatuses->removeElement($orderStatus);
            // set the owning side to null (unless already changed)
            if ($orderStatus->getOrder() === $this) {
                $orderStatus->setOrder(null);
            }
        }

        return $this;
    }

    public function addOrderProduct(OrderProduct $orderProduct): self
    {
        if (!$this->orderProduct->contains($orderProduct)) {
            $this->orderProduct[] = $orderProduct;
            $orderProduct->setOrder($this);
        }

        return $this;
    }

    /**
     * @return Collection|OrderProduct[]
     */
    public function getProducts(): Collection
    {
        return $this->orderProduct;
    }

    public function removeOrderProduct(OrderProduct $orderProduct): self
    {
        if ($this->orderProduct->contains($orderProduct)) {
            $orderProduct->getProduct()->removeOrderProduct($orderProduct);
            $this->orderProduct->removeElement($orderProduct);
        }

        return $this;
    }

    public function isProductInOrder(Product $product): bool
    {
        /** @var $productInOrder OrderProduct */
        foreach ($this->orderProduct as $productInOrder) {
            if ($product->getUuid() === $productInOrder->getUuid()) {
                return true;
            }
        }

        return false;
    }

    public function getParent(): ?self
    {
        return $this->parent;
    }

    public function setParent(?self $parent): self
    {
        $this->parent = $parent;

        return $this;
    }

    /**
     * @return Collection|self[]
     */
    public function getChildren(): Collection
    {
        return $this->children;
    }

    public function addChild(self $child): self
    {
        if (!$this->children->contains($child)) {
            $this->children[] = $child;
            $child->setParent($this);
        }

        return $this;
    }

    public function removeChild(self $child): self
    {
        if ($this->children->contains($child)) {
            $this->children->removeElement($child);
            // set the owning side to null (unless already changed)
            if ($child->getParent() === $this) {
                $child->setParent(null);
            }
        }

        return $this;
    }

    public function getAggregatePartials(): array
    {
        $products = [];

        $children = $this->getChildren();
        if (\in_array($this->getStatus(), [self::STATUS_DELIVERED, self::STATUS_SENT], false)) {
            $children = [$this];
        }

        foreach ($children as $child) {
            foreach ($child->getProducts() as $orderProduct) {
                $productKey = array_search($orderProduct->getUuid(), array_column($products, 'uuid'), true);
                if (false === $productKey) {
                    $products[] = [
                        'quantity' => $orderProduct->getQuantity(),
                        'uuid' => $orderProduct->getUuid(),
                        'product' => [
                            'code' => $orderProduct->getProduct()->getCode(),
                        ],
                    ];
                } else {
                    $products[$productKey]['quantity'] = $orderProduct->getQuantity() + $products[$productKey]['quantity'];
                }
            }
        }

        return $products;
    }

    public function getPendingOrderProductsQuantities(): array
    {
        $aggregatePartials = $this->getAggregatePartials();
        $missingProductOrderQuantities = [];

        foreach ($this->getProducts() as $orderProduct) {
            $productKey = array_search($orderProduct->getUuid(), array_column($aggregatePartials, 'uuid'), true);

            $leftProductQuantity = $orderProduct->getQuantity();
            if (false !== $productKey) {
                $leftProductQuantity = $orderProduct->getQuantity() - $aggregatePartials[$productKey]['quantity'];
                if ($leftProductQuantity < 0) {
                    throw new InvalidArgumentException('The pending quantity for this product is below that 0.');
                }
            }

            $missingProductOrderQuantities[] = [
                'uuid' => $orderProduct->getUuid(),
                'quantity' => $leftProductQuantity,
            ];
        }

        return $missingProductOrderQuantities;
    }

    public function getOrderProductsUuids(): array
    {
        $uuids = [];

        foreach ($this->getProducts() as $orderProduct) {
            $uuids[] = $orderProduct->getUuid();
        }

        return $uuids;
    }
}
