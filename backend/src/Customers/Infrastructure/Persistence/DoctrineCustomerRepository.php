<?php

namespace App\Customers\Infrastructure\Persistence;

use App\Customers\Domain\Error\CustomerNotFound;
use App\Customers\Domain\Model\Customer;
use App\Customers\Domain\Repository\CustomerRepository;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineCustomerRepository implements CustomerRepository
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function get(int $id): Customer
    {
        return $this->em->find(Customer::class, $id) ?? throw new CustomerNotFound();
    }

    public function findByEmail(string $email): ?Customer
    {
        return $this->em->getRepository(Customer::class)->findOneBy(['email' => $email]);
    }

    public function findByPhone(string $phone): ?Customer
    {
        return $this->em->getRepository(Customer::class)->findOneBy(['phone' => $phone]);
    }

    public function add(Customer $customer): void
    {
        $this->em->persist($customer);
    }

    public function remove(Customer $customer): void
    {
        $this->em->remove($customer);
    }
}
