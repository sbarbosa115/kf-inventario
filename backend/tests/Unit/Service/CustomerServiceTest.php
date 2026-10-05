<?php

namespace App\Tests\Unit\Service;

use App\Entity\City;
use App\Entity\Customer;
use App\Entity\CustomerAddress;
use App\Services\CustomerService;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class CustomerServiceTest extends WebTestCase
{
    public $client;

    public function setUp(): void
    {
        $this->client = static::createClient();
    }

    public function testCreateCustomer(): void
    {
        // Data for this test was taken from Fixtures.
        /** @var $customerService CustomerService */
        $customerService = $this->client->getContainer()->get(CustomerService::class);

        /** @var $city City */
        $city = $this->client->getContainer()->get('doctrine')
            ->getRepository(City::class)->findOneBy(['name' => 'West Palm Beach']);

        $customerData = [
            'firstName' => 'Customer',
            'lastName' => 'Test',
            'email' => 'customer@example.com',
            'phone' => '305 4887945',
            'addresses' => [
                [
                    'addressType' => CustomerAddress::ADDRESS_BILLING,
                    'address' => '9999 Test Street Drive Test',
                    'zipCode' => '99999',
                    'city' => [
                        'id' => $city->getId(),
                    ],
                ],
            ],
        ];

        $customerService->addOrUpdate($customerData);

        $customer = $this->client->getContainer()->get('doctrine')
            ->getRepository(Customer::class)->findOneBy(['email' => 'customer@example.com']);
        $this->assertInstanceOf(Customer::class, $customer);
    }
}
