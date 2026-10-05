<?php

namespace App\Ordering\Infrastructure\Customers;

use App\Customers\Domain\Model\City;
use App\Customers\Domain\Model\Country;
use App\Customers\Domain\Model\Customer;
use App\Customers\Domain\Model\CustomerAddress;
use App\Customers\Domain\Model\State;
use App\Ordering\Application\Command\OrderAddress;
use App\Ordering\Application\Command\OrderCustomer;
use App\Ordering\Application\Port\CustomerBook;
use Doctrine\ORM\EntityManagerInterface;

/**
 * The legacy CustomerService::addOrUpdate rule, for an order's customer, on the Customers models (in the caller's
 * transaction, without its flushes).
 *
 * Customers' own CustomerRegistry (item 3 of the restructure) was being built at the same time as this: once it is
 * merged, this adapter can delegate to it (docs/pdr/prd-restructure.md, "Ordering → Customers").
 */
final class DoctrineCustomerBook implements CustomerBook
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function addOrUpdate(OrderCustomer $customer): Customer
    {
        // As before: an id decides alone (an id not found creates a new customer), then the email, then the phone.
        $existing = match (true) {
            null !== $customer->id => $this->em->find(Customer::class, $customer->id),
            null !== $customer->email => $this->em->getRepository(Customer::class)->findOneBy(['email' => $customer->email]),
            null !== $customer->phone => $this->em->getRepository(Customer::class)->findOneBy(['phone' => $customer->phone]),
            default => null,
        };
        $record = $existing ?? new Customer();

        $record->setEmail($customer->email);
        $record->setFirstName((string) $customer->firstName);
        $record->setLastName($customer->lastName ?? '');
        $record->setPhone((string) $customer->phone);
        $record->removeAllAddresses();
        foreach ($customer->addresses as $address) {
            $record->addAddress($this->address($address));
        }
        $this->em->persist($record);

        return $record;
    }

    private function address(OrderAddress $data): CustomerAddress
    {
        $address = new CustomerAddress();
        $address->setCity($this->city($data));
        $address->setAddress($data->address);
        $address->setZipCode($data->zipCode);
        $address->setAddressType($data->addressType);

        return $address;
    }

    private function city(OrderAddress $data): City
    {
        $city = null === $data->cityId ? null : $this->em->find(City::class, $data->cityId);
        if (null === $city) {
            $city = new City();
            $city->setState($this->state($data));
            $city->setName((string) $data->cityName);
            $this->em->persist($city);
        }

        return $city;
    }

    private function state(OrderAddress $data): State
    {
        $state = null === $data->stateId ? null : $this->em->find(State::class, $data->stateId);
        if (null === $state) {
            $state = new State();
            $state->setName((string) $data->stateName);
            // As before, a state created from an order takes its name as its code; cut to the column's 10 characters
            // (state.code is VARCHAR(10): a longer name made the legacy insert fail).
            $state->setCode(null === $data->stateName ? null : mb_substr($data->stateName, 0, 10));
            $state->setCountry($this->country($data));
            $this->em->persist($state);
        }

        return $state;
    }

    private function country(OrderAddress $data): Country
    {
        $country = null === $data->countryId ? null : $this->em->find(Country::class, $data->countryId);
        if (null === $country) {
            $country = new Country();
            $country->setName((string) $data->countryName);
            $this->em->persist($country);
        }

        return $country;
    }
}
