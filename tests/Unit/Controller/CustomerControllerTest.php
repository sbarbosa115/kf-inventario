<?php

namespace App\Tests\Unit\Controller;

use App\Entity\CustomerAddress;
use App\Services\CustomerService;
use App\Tests\Unit\Utils\UserWebTestCase;
use Symfony\Bundle\FrameworkBundle\Client;
use Symfony\Component\HttpFoundation\Response;

class CustomerControllerTest extends UserWebTestCase
{
    /** @var Client */
    public $client;

    private const DEFAULT_CUSTOMER = 1;

    public function setUp(): void
    {
        $this->client = static::createClient();
    }

    /**
     * @dataProvider getUrlsForRoleUpdate
     */
    public function testOkByAllRoutes(string $httpMethod, string $url): void
    {
        $this->logIn();
        $this->client->request($httpMethod, $url);
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
    }

    public function getUrlsForRoleUpdate(): ?\Generator
    {
        yield ['GET', '/admin/customer/'];
        yield ['GET', '/admin/customer/edit/'.self::DEFAULT_CUSTOMER];
    }

    private function createAddress(array $addressData = []): array
    {
        return array_merge_recursive([
            'addressType' => CustomerAddress::ADDRESS_BILLING,
            'zipCode' => 99999,
            'address' => 'ADDRESS NAME ST 999 AV',
            'city' => [
                //Taken from fixtures
                'id' => 1,
            ],
        ], $addressData);
    }

    public function testEditCustomerBasicData(): void
    {
        $this->logIn();
        $customer = $this->getCustomerById(self::DEFAULT_CUSTOMER);

        /** @var $customerService CustomerService */
        $customerService = $this->client->getContainer()->get(CustomerService::class);
        $customerAsArray = $customerService->getCustomerAsArray($customer);
        $customerAsArray['firstName'] = 'TESTING';
        $customerAsArray['lastName'] = 'TESTING';
        $customerAsArray['email'] = 'TESTING@TESTING.COM';
        $this->client->request('post', '/admin/customer/update', [], [], [], json_encode($customerAsArray));
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());

        $editedCustomer = $this->getCustomerById(self::DEFAULT_CUSTOMER);
        $this->assertSame('TESTING', $editedCustomer->getFirstName());
        $this->assertSame('TESTING', $editedCustomer->getLastName());
        $this->assertSame('TESTING@TESTING.COM', $editedCustomer->getEmail());

        $this->client->request('post', '/admin/customer/update', [], [], [], json_encode($customerAsArray));
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
    }

    public function testAddEditAndRemoveCustomerAddresses(): void
    {
        $this->logIn();
        /** @var $customerService CustomerService */
        $customerService = $this->client->getContainer()->get(CustomerService::class);

        $customer = $this->getCustomerById(self::DEFAULT_CUSTOMER);
        $customerAsArray = $customerService->getCustomerAsArray($customer);
        $customerAsArray['addresses'][] = $this->createAddress();
        $this->client->request('post', '/admin/customer/update', [], [], [], json_encode($customerAsArray));
        $customer = $this->getCustomerById(self::DEFAULT_CUSTOMER);

        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
        $this->assertSame(2, $customer->getAddresses()->count());

        //Editing Routine
        $customerAsArray = $customerService->getCustomerAsArray($customer);
        $editedCustomerAddress = [
            'zipCode' => 88888,
            'address' => 'EDITED ADDRESS 9999 ST',
        ];
        $customerAsArray['addresses'][1] = array_replace($customerAsArray['addresses'][1], $editedCustomerAddress);
        $this->client->request('post', '/admin/customer/update', [], [], [], json_encode($customerAsArray));
        $customer = $this->getCustomerById(self::DEFAULT_CUSTOMER);
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
        /** @var $editedAddress CustomerAddress */
        $editedAddress = $customer->getAddresses()->last();
        $this->assertSame(2, $customer->getAddresses()->count());
        $this->assertSame('88888', $editedAddress->getZipCode());
        $this->assertSame('EDITED ADDRESS 9999 ST', $editedAddress->getAddress());

        //Deleting Added Address
        $customerAsArray = $customerService->getCustomerAsArray($customer);
        unset($customerAsArray['addresses'][1]);
        $this->client->request('post', '/admin/customer/update', [], [], [], json_encode($customerAsArray));
        $customer = $this->getCustomerById(self::DEFAULT_CUSTOMER);
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
        $this->assertSame(1, $customer->getAddresses()->count());
    }

    public function testAddAndDeleteCustomer(): void
    {
        $this->logIn();

        $newCustomer = $this->createCustomerStructure([
            'firstName' => 'NEW_CUSTOMER',
            'lastName' => 'NEW_CUSTOMER',
            'email' => 'new-customer@new-customer.com',
        ]);
        $this->client->request('post', '/admin/customer/create', [], [], [
            'HTTP_X-Requested-With' => 'XMLHttpRequest',
        ], json_encode($newCustomer));
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());

        $customer = $this->getCustomerByEmail('new-customer@new-customer.com');
        $this->assertSame('NEW_CUSTOMER', $customer->getFirstName());
        $this->assertSame('NEW_CUSTOMER', $customer->getLastName());
        $this->assertSame('new-customer@new-customer.com', $customer->getEmail());

        $crawler = $this->client->request('get', '/admin/customer/');
        $token = $crawler->filter('#index-customer')->getNode(0)->getAttribute('data-token');

        $this->client->request('delete', '/admin/customer/delete', [], [], [
            'HTTP_X-Requested-With' => 'XMLHttpRequest',
        ], json_encode(['customer' => $customer->getId(), 'token' => $token]));
        $this->assertSame(Response::HTTP_OK, $this->client->getResponse()->getStatusCode());
    }
}
