<?php

namespace App\Entity;

use DateTime;
use DateTimeInterface;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

/**
 * @ORM\Entity(repositoryClass="App\Repository\InvoiceRepository")
 * @ORM\Table(name="invoice")
 */
class Invoice
{
    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    /** @ORM\Column(type="string", length=255, nullable=true) */
    private $code;

    /**
     * @ORM\ManyToOne(targetEntity="App\Entity\Customer")
     * @ORM\JoinColumn(nullable=true)
     */
    private $customer;

    /** @ORM\OneToMany(targetEntity="App\Entity\InvoiceItem", mappedBy="invoice", cascade={"persist", "remove"}) */
    private $items;

    /** @ORM\Column(type="decimal", precision=12, scale=2, nullable=true) */
    private $total;

    /** @ORM\Column(type="integer", nullable=true) */
    private $status;

    /** @ORM\Column(type="datetime", nullable=true) */
    private $createdAt;

    /** @ORM\Column(type="datetime", nullable=true) */
    private $modifiedAt;

    /** @ORM\Column(type="text", nullable=true) */
    private $comment;

    /** @ORM\Column(type="string", length=100, nullable=true) */
    private $paymentMethod;

    /** @ORM\Column(type="decimal", precision=5, scale=2, nullable=true) */
    private $taxRate;

    /** @ORM\Column(type="decimal", precision=12, scale=2, nullable=true) */
    private $taxAmount;

    /** @ORM\Column(type="string", length=255, nullable=true) */
    private $customerNit;

    /** @ORM\Column(type="text", nullable=true) */
    private $customerAddress;

    public function __construct()
    {
        $this->items = new ArrayCollection();
        if (null === $this->getCreatedAt()) {
            $this->setCreatedAt(new DateTime());
        }
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

    /** @return Collection|InvoiceItem[] */
    public function getItems(): Collection
    {
        return $this->items;
    }

    public function addItem(InvoiceItem $item): self
    {
        if (!$this->items->contains($item)) {
            $this->items[] = $item;
            $item->setInvoice($this);
        }

        return $this;
    }

    public function removeItem(InvoiceItem $item): self
    {
        if ($this->items->contains($item)) {
            $this->items->removeElement($item);
            if ($item->getInvoice() === $this) {
                $item->setInvoice(null);
            }
        }

        return $this;
    }

    public function getTotal(): ?string
    {
        return $this->total;
    }

    public function setTotal(?string $total): self
    {
        $this->total = $total;

        return $this;
    }

    public function getStatus(): ?int
    {
        return $this->status;
    }

    public function setStatus(?int $status): self
    {
        $this->status = $status;

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

    public function getComment(): ?string
    {
        return $this->comment;
    }

    public function setComment(?string $comment): self
    {
        $this->comment = $comment;

        return $this;
    }

    public function getPaymentMethod(): ?string
    {
        return $this->paymentMethod;
    }

    public function setPaymentMethod(?string $paymentMethod): self
    {
        $this->paymentMethod = $paymentMethod;

        return $this;
    }

    public function getTaxRate(): ?string
    {
        return $this->taxRate;
    }

    public function setTaxRate(?string $taxRate): self
    {
        $this->taxRate = $taxRate;

        return $this;
    }

    public function getTaxAmount(): ?string
    {
        return $this->taxAmount;
    }

    public function setTaxAmount(?string $taxAmount): self
    {
        $this->taxAmount = $taxAmount;

        return $this;
    }

    public function getCustomerNit(): ?string
    {
        return $this->customerNit;
    }

    public function setCustomerNit(?string $customerNit): self
    {
        $this->customerNit = $customerNit;

        return $this;
    }

    public function getCustomerAddress(): ?string
    {
        return $this->customerAddress;
    }

    public function setCustomerAddress(?string $customerAddress): self
    {
        $this->customerAddress = $customerAddress;

        return $this;
    }

    public function getSubtotal(): ?string
    {
        $total = 0.0;
        foreach ($this->getItems() as $item) {
            $line = $item->getTotal();
            if ($line !== null && $line !== '') {
                $total += (float) $line;
            }
        }

        return number_format($total, 2, '.', '');
    }
}
