<?php

namespace App\DataFixtures;

use App\Entity\Customer;
use App\Entity\CustomerAddress;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

class CustomerFixtures extends Fixture implements DependentFixtureInterface
{
    public const CUSTOMER = 'customer';

    public function load(ObjectManager $manager): void
    {
        $this->createWarehouses($manager);
    }

    protected function createWarehouses(ObjectManager $manager): void
    {
        $items = [
            [
                'first_name' => 'Jose',
                'last_name' => 'Perez',
                'email' => 'jose.perez@example.com',
                'phone' => '+57 3002825566',
            ],
        ];

        foreach ($items as $item) {
            $customer = new Customer();
            $customer->setFirstName($item['first_name']);
            $customer->setLastName($item['last_name']);
            $customer->setEmail($item['email']);
            $customer->setPhone($item['phone']);
            $manager->persist($customer);

            $customerAddress = new CustomerAddress();
            $customerAddress->setCustomer($customer);
            $customerAddress->setAddress('Palm Beach 5800 Roger Regan Drive');
            $customerAddress->setCity($this->getReference(LocationFixtures::DEFAULT_CITY));
            $customerAddress->setZipCode(33415);
            $manager->persist($customerAddress);

            $this->addReference(self::CUSTOMER, $customer);
        }
        $manager->flush();
    }

    public function getDependencies(): array
    {
        return [
            LocationFixtures::class,
        ];
    }
}
