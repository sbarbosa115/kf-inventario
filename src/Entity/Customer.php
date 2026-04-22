<?php

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Gedmo\Mapping\Annotation as Gedmo;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity(repositoryClass="App\Repository\CustomerRepository")
 * @UniqueEntity("email")
 * @Gedmo\SoftDeleteable(fieldName="deletedAt", timeAware=false, hardDelete=true)
 */
class Customer
{
    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    /**
     * @ORM\Column(type="string", length=255)
     */
    private $firstName;

    /**
     * @ORM\Column(type="string", length=255)
     */
    private $lastName;

    /**
     * @Assert\NotNull()
     * @Assert\Email()
     * @ORM\Column(type="string", length=255, nullable=true)
     */
    private $email;

    /**
     * @ORM\Column(type="string", length=255, nullable=true)
     */
    private $phone;

    /**
     * @ORM\OneToMany(targetEntity="Order", mappedBy="customer", orphanRemoval=true)
     */
    private $request;

    /**
     * @ORM\OneToMany(targetEntity="App\Entity\CustomerAddress", mappedBy="customer",  cascade={"persist", "remove"}, orphanRemoval=true)
     */
    private $addresses;

    /**
     * @ORM\Column(type="datetime", nullable=true)
     */
    private $deletedAt;

    public function __construct()
    {
        $this->request = new ArrayCollection();
        $this->addresses = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getFirstName(): ?string
    {
        return $this->firstName;
    }

    public function setFirstName(string $firstName): self
    {
        $this->firstName = $firstName;

        return $this;
    }

    public function getLastName(): ?string
    {
        return $this->lastName;
    }

    public function setLastName(string $lastName): self
    {
        $this->lastName = $lastName;

        return $this;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(?string $email): self
    {
        $this->email = $email;

        return $this;
    }

    public function getPhone(): ?string
    {
        return $this->phone;
    }

    public function setPhone(string $phone): self
    {
        $this->phone = $phone;

        return $this;
    }

    /**
     * @return Collection|Order[]
     */
    public function getRequest(): Collection
    {
        return $this->request;
    }

    public function addRequest(Order $request): self
    {
        if (!$this->request->contains($request)) {
            $this->request[] = $request;
            $request->setCustomer($this);
        }

        return $this;
    }

    public function removeRequest(Order $request): self
    {
        if ($this->request->contains($request)) {
            $this->request->removeElement($request);
            // set the owning side to null (unless already changed)
            if ($request->getCustomer() === $this) {
                $request->setCustomer(null);
            }
        }

        return $this;
    }

    public function getFullName(): string
    {
        return "{$this->firstName } {$this->lastName }";
    }

    /**
     * Returns deletedAt.
     *
     * @return \DateTime
     */
    public function getDeletedAt(): ?\DateTime
    {
        return $this->deletedAt;
    }

    /**
     * @return Collection|CustomerAddress[]
     */
    public function getAddresses(): Collection
    {
        return $this->addresses;
    }

    public function addAddress(CustomerAddress $address): self
    {
        if (!$this->addresses->contains($address)) {
            $this->addresses[] = $address;
            $address->setCustomer($this);
        }

        return $this;
    }

    public function removeAddress(CustomerAddress $address): self
    {
        if ($this->addresses->contains($address)) {
            $this->addresses->removeElement($address);
            // set the owning side to null (unless already changed)
            if ($address->getCustomer() === $this) {
                $address->setCustomer(null);
            }
        }

        return $this;
    }

    public function removeAllAddresses(): self
    {
        $this->addresses = new ArrayCollection();
        return $this;
    }

    public function getDefaultAddress(): ?CustomerAddress
    {
        if ($this->getAddresses()->count() > 0) {
            return $this->getAddresses()->first();
        }

        return null;
    }
}
