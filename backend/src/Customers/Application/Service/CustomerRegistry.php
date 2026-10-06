<?php

namespace App\Customers\Application\Service;

use App\Customers\Application\Command\AddressData;
use App\Customers\Application\Command\CityData;
use App\Customers\Application\Command\CountryData;
use App\Customers\Application\Command\SaveCustomer;
use App\Customers\Application\Command\StateData;
use App\Customers\Domain\Error\CustomerNotFound;
use App\Customers\Domain\Model\City;
use App\Customers\Domain\Model\Country;
use App\Customers\Domain\Model\Customer;
use App\Customers\Domain\Model\CustomerAddress;
use App\Customers\Domain\Model\State;
use App\Customers\Domain\Repository\CustomerRepository;
use App\Customers\Domain\Repository\LocationRepository;

/**
 * Finds or creates a customer from the data of a form, an order or the webhook (what CustomerService::addOrUpdate
 * did), and the countries, states and cities their addresses name. Customers, Ordering and Invoicing call it inside
 * their own command: it never flushes, the bus commits.
 */
final class CustomerRegistry
{
    /** The width of the code column of country and state. */
    private const CODE_LENGTH = 10;

    public function __construct(
        private readonly CustomerRepository $customers,
        private readonly LocationRepository $locations,
    ) {
    }

    /**
     * The customer with that id; without an id (or when it names nobody: as before, that makes a new customer) the
     * one with that email, else, only when no email was sent, the one with that phone. Then their data is set and
     * their addresses replaced.
     */
    public function addOrUpdate(SaveCustomer $data): Customer
    {
        $customer = null;
        if (null !== $data->id) {
            $customer = $this->find($data->id);
        } elseif (null !== $data->email) {
            $customer = $this->customers->findByEmail($data->email);
        } elseif (null !== $data->phone) {
            $customer = $this->customers->findByPhone($data->phone);
        }

        if (null !== $customer && self::namesOnly($data)) {
            // An order or invoice that names an existing customer by id alone: use them as they are.
            return $customer;
        }

        $customer ??= new Customer();
        $customer->setEmail($data->email);
        $customer->setFirstName($data->firstName ?? '');
        $customer->setLastName($data->lastName ?? '');
        $customer->setPhone($data->phone ?? '');
        $this->replaceAddresses($customer, $data->addresses);
        $this->customers->add($customer);

        return $customer;
    }

    private function find(int $id): ?Customer
    {
        try {
            return $this->customers->get($id);
        } catch (CustomerNotFound) {
            return null;
        }
    }

    /**
     * @param list<AddressData> $addresses
     */
    private function replaceAddresses(Customer $customer, array $addresses): void
    {
        foreach ($customer->getAddresses()->toArray() as $old) {
            $customer->removeAddress($old);
        }

        foreach ($addresses as $data) {
            $address = new CustomerAddress();
            $address->setCity(null === $data->city ? null : $this->city($data->city));
            $address->setAddress($data->address);
            $address->setZipCode($data->zipCode);
            $address->setAddressType($data->addressType);
            $customer->addAddress($address);
        }
    }

    private function city(CityData $data): ?City
    {
        $city = null === $data->id ? null : $this->locations->findCity($data->id, null);
        if ($city instanceof City) {
            return $city;
        }
        if (null === $data->name || '' === trim($data->name)) {
            return null;
        }

        $state = $this->state($data->state ?? new StateData());
        // Looked up in the state's own cities: two states may have a city of the same name, and one added a moment
        // ago in this same request is there too.
        foreach ($state->getCities() as $existing) {
            if (self::same($existing->getName(), $data->name)) {
                return $existing;
            }
        }

        $city = new City();
        $city->setName($data->name);
        $state->addCity($city);
        $this->locations->add($city);

        return $city;
    }

    private function state(StateData $data): State
    {
        $state = null === $data->id ? null : $this->locations->findState($data->id, null);
        if ($state instanceof State) {
            return $state;
        }
        $name = $data->name ?? '';

        $country = $this->country($data->country ?? new CountryData());
        foreach ($country->getStates() as $existing) {
            if (self::same($existing->getName(), $name) || self::same($existing->getCode(), $name) || (null !== $data->code && self::same($existing->getCode(), $data->code))) {
                return $existing;
            }
        }

        $state = new State();
        $state->setName($name);
        // As before, a state made on the fly takes its name as code unless one came with it (the column holds 10).
        $state->setCode(mb_substr($data->code ?? $name, 0, self::CODE_LENGTH));
        $country->addState($state);
        $this->locations->add($state);

        return $state;
    }

    private function country(CountryData $data): Country
    {
        $country = null === $data->id ? null : $this->locations->findCountry($data->id, null);
        if ($country instanceof Country) {
            return $country;
        }
        $name = $data->name ?? '';

        $country = $this->locations->findCountry(null, $name);
        if (!$country instanceof Country) {
            $country = new Country();
            $country->setName($name);
            $country->setCode(null === $data->code ? null : mb_substr($data->code, 0, self::CODE_LENGTH));
            $this->locations->add($country);
        }

        return $country;
    }

    private static function same(?string $a, ?string $b): bool
    {
        return null !== $a && null !== $b && 0 === strcasecmp($a, $b);
    }

    /**
     * Only the id: no name, email, phone or address to save (the legacy forms always sent the whole customer).
     */
    private static function namesOnly(SaveCustomer $data): bool
    {
        return null === $data->firstName && null === $data->lastName && null === $data->email && null === $data->phone && [] === $data->addresses;
    }
}
