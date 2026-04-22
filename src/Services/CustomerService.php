<?php

namespace App\Services;

use App\Entity\City;
use App\Entity\Country;
use App\Entity\Customer;
use App\Entity\CustomerAddress;
use App\Entity\State;
use App\Repository\CityRepository;
use App\Repository\CountryRepository;
use App\Repository\CustomerRepository;
use App\Repository\StateRepository;
use Doctrine\ORM\EntityManagerInterface;
use InvalidArgumentException;
use Symfony\Component\Serializer\Exception\ExceptionInterface;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;

class CustomerService
{
    private EntityManagerInterface $objectManager;

    private CustomerRepository $customerRepo;

    private CityRepository $cityRepo;

    private StateRepository $stateRepo;

    private CountryRepository $countryRepo;

    public function __construct(
        EntityManagerInterface $objectManager,
        CustomerRepository $customerRepo,
        CityRepository $cityRepo,
        StateRepository $stateRepo,
        CountryRepository $countryRepo
    ) {
        $this->objectManager = $objectManager;
        $this->customerRepo = $customerRepo;
        $this->cityRepo = $cityRepo;
        $this->stateRepo = $stateRepo;
        $this->countryRepo = $countryRepo;
    }

    public function addOrUpdate(array $customerData): Customer
    {
        $customer = null;

        if (isset($customerData['id'])) {
            $customer = $this->customerRepo->find($customerData['id']);
        } else if (isset($customerData['email']) && $customer === null) {
            $customer = $this->customerRepo->findOneBy(['email' => $customerData['email']]);
        } else if (isset($customerData['phone']) && $customer === null) {
            $customer = $this->customerRepo->findOneBy(['phone' => $customerData['phone']]);
        }

        if ($customer instanceof Customer) {
            $this->update($customerData, $customer);
        } else {
            $customer = $this->add($customerData);
        }

        return $customer;
    }

    public function add(array $customerData): Customer {
        $customer = new Customer();
        $this->setCustomerData($customerData, $customer);

        return $customer;
    }

    public function update(array $customerData, Customer $customer): Customer {
        $this->setCustomerData($customerData, $customer);

        return $customer;
    }

    public function setCustomerData(array $customerData, Customer $customer): void
    {
        $customer->setEmail($customerData['email']);
        $customer->setFirstName($customerData['firstName']);
        $customer->setLastName($customerData['lastName'] ?? '');
        $customer->setPhone($customerData['phone']);
        $this->syncAddresses($customer, $customerData['addresses']);

        $this->objectManager->persist($customer);
        $this->objectManager->flush();
    }

    public function delete(Customer $customer): void
    {
        $this->objectManager->remove($customer);
        $this->objectManager->flush();
    }

    public function findOrCreateCity(array $cityData): City
    {
        $city = isset($cityData['id']) ? $this->cityRepo->find($cityData['id']) : null;

        if (!$city instanceof City) {
            $state = $this->findOrCreateState($cityData['state']);
            $city = new City();
            $city->setState($state);
            $city->setName($cityData['name']);
            $this->objectManager->persist($city);
            $this->objectManager->flush();
        }

        return $city;
    }

    public function findOrCreateState(array $stateData): State
    {
        $state = isset($stateData['id']) ? $this->stateRepo->find($stateData['id']) : null;

        if (!$state instanceof State) {
            $country = $this->findOrCreateCountry($stateData['country']);
            $state = new State();
            $state->setName($stateData['name']);
            $state->setCode($stateData['name']);
            $state->setCountry($country);
            $this->objectManager->persist($state);
            $this->objectManager->flush();
        }

        return $state;
    }

    public function findOrCreateCountry(array $countryData): Country
    {
        $country = isset($countryData['id']) ? $this->countryRepo->find($countryData['id']) : null;

        if (!$country instanceof Country) {
            $country = new Country();
            $country->setName($countryData['name']);
            $this->objectManager->persist($country);
            $this->objectManager->flush();
        }

        return $country;
    }

    public function syncAddresses(Customer $customer, array $addresses): void
    {
        $customer->removeAllAddresses();

        foreach ($addresses as $addressData) {
            $customerAddress = new CustomerAddress();

            $city = $this->findOrCreateCity($addressData['city']);
            $customerAddress->setCity($city);

            $customerAddress->setAddress($addressData['address']);
            $customerAddress->setZipCode($addressData['zipCode']);
            $customerAddress->setAddressType($addressData['addressType'] ?? null);

            $customer->addAddress($customerAddress);

            $this->objectManager->persist($customer);
        }

        $this->objectManager->flush();
    }

    public function getCustomerArrayTemplate(): array
    {
        return [
            'id',
            'firstName',
            'lastName',
            'email',
            'phone',
            'addresses' => [
                'id', 'zipCode', 'address', 'addressType', 'city' => [
                    'id', 'name', 'state' => [
                        'id', 'name', 'code', 'country' => [
                            'id', 'name',
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * @return Customer[]
     */
    public function getCustomers(): array
    {
        return $this->customerRepo->findAll();
    }

    /**
     * @throws ExceptionInterface
     */
    private function serializeCustomer(Customer $customer = null, array $customers = null): array
    {
        $entityOrCollection = $customer;
        if (null !== $customers) {
            $entityOrCollection = $customers;
        }
        $serializer = new Serializer([new ObjectNormalizer()]);

        return $serializer->normalize($entityOrCollection, 'array', ['attributes' => $this->getCustomerArrayTemplate()]);
    }

    public function getCustomersAsArray(): array
    {
        return $this->serializeCustomer(null, $this->getCustomers());
    }

    public function getCustomerAsArray(Customer $customer): array
    {
        return $this->serializeCustomer($customer);
    }

    public function getCustomerById(int $customerId): Customer
    {
        $customer = $this->customerRepo->find($customerId);

        if (!$customer instanceof Customer) {
            throw new InvalidArgumentException('Invalid exception');
        }

        return $customer;
    }
}
