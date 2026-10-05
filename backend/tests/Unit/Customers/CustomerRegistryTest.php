<?php

namespace App\Tests\Unit\Customers;

use App\Customers\Application\Command\AddressData;
use App\Customers\Application\Command\CityData;
use App\Customers\Application\Command\CountryData;
use App\Customers\Application\Command\SaveCustomer;
use App\Customers\Application\Command\StateData;
use App\Customers\Application\Service\CustomerRegistry;
use App\Customers\Domain\Error\CustomerNotFound;
use App\Customers\Domain\Model\City;
use App\Customers\Domain\Model\Country;
use App\Customers\Domain\Model\Customer;
use App\Customers\Domain\Model\State;
use App\Customers\Domain\Repository\CustomerRepository;
use App\Customers\Domain\Repository\LocationRepository;
use PHPUnit\Framework\TestCase;

final class CustomerRegistryTest extends TestCase
{
    private InMemoryCustomers $customers;
    private InMemoryLocations $locations;
    private CustomerRegistry $registry;

    protected function setUp(): void
    {
        $this->customers = new InMemoryCustomers();
        $this->locations = new InMemoryLocations();
        $this->registry = new CustomerRegistry($this->customers, $this->locations);
    }

    public function testTheIdWinsOverTheEmailAndThePhone(): void
    {
        $byId = $this->customers->has(1, 'a@kf.test', '111');
        $this->customers->has(2, 'b@kf.test', '222');

        $found = $this->registry->addOrUpdate(new SaveCustomer(1, 'Ana', 'Diaz', 'b@kf.test', '222'));

        self::assertSame($byId, $found, 'An id names the customer, whatever the email and phone say.');
        self::assertSame('b@kf.test', $found->getEmail());
    }

    public function testWithoutAnIdTheEmailFindsThemAndThePhoneIsNotTried(): void
    {
        $byEmail = $this->customers->has(1, 'a@kf.test', '111');
        $this->customers->has(2, 'x@kf.test', '222');

        $found = $this->registry->addOrUpdate(new SaveCustomer(null, 'Ana', null, 'a@kf.test', '222'));
        self::assertSame($byEmail, $found, 'The email is looked up before the phone.');

        $other = $this->registry->addOrUpdate(new SaveCustomer(null, 'Bo', null, 'new@kf.test', '222'));
        self::assertNotSame($this->customers->byId[2], $other, 'As before: a sent email that finds nobody makes a new customer, the phone is not tried.');
    }

    public function testWithoutAnIdOrAnEmailThePhoneFindsThem(): void
    {
        $byPhone = $this->customers->has(2, 'x@kf.test', '222');

        $found = $this->registry->addOrUpdate(new SaveCustomer(null, 'Ana', null, null, '222'));

        self::assertSame($byPhone, $found);
    }

    public function testAnIdThatNamesNobodyMakesANewCustomer(): void
    {
        $found = $this->registry->addOrUpdate(new SaveCustomer(99, 'Ana', null, 'a@kf.test', '111'));

        self::assertNull($found->getId());
        self::assertSame('Ana', $found->getFirstName());
        self::assertSame('', $found->getLastName(), 'A missing last name is stored empty, as before.');
        self::assertContains($found, $this->customers->added);
    }

    public function testSavingReplacesTheWholeAddressSet(): void
    {
        $customer = $this->customers->has(1, 'a@kf.test', '111');
        $city = new City();
        $city->setName('Miami');
        $this->registry->addOrUpdate(new SaveCustomer(1, 'Ana', 'Diaz', 'a@kf.test', '111', [
            new AddressData('1 Main', '33100', 1, new CityData(null, 'Miami', new StateData(null, 'Florida', 'FL', new CountryData(null, 'USA')))),
        ]));
        $this->registry->addOrUpdate(new SaveCustomer(1, 'Ana', 'Diaz', 'a@kf.test', '111', [
            new AddressData('2 Side', '33101', 2, new CityData(null, 'Miami', new StateData(null, 'Florida'))),
        ]));

        self::assertCount(1, $customer->getAddresses(), 'The old addresses are gone.');
        self::assertSame('2 Side', $customer->getAddresses()->first()->getAddress());
    }

    public function testANewCountryStateAndCityNamedTwiceAreCreatedOnce(): void
    {
        $city = static fn () => new CityData(null, 'Lima', new StateData(null, 'Lima Region', null, new CountryData(null, 'Peru', 'PE')));

        $customer = $this->registry->addOrUpdate(new SaveCustomer(null, 'Ana', null, 'a@kf.test', '111', [
            new AddressData('1 Main', null, 1, $city()),
            new AddressData('1 Main', null, 2, $city()),
        ]));

        self::assertCount(2, $customer->getAddresses());
        self::assertCount(1, array_filter($this->locations->added, static fn ($l) => $l instanceof Country), 'One Peru.');
        self::assertCount(1, array_filter($this->locations->added, static fn ($l) => $l instanceof State), 'One state.');
        self::assertCount(1, array_filter($this->locations->added, static fn ($l) => $l instanceof City), 'One city.');
        $country = $this->locations->added[0];
        self::assertSame('PE', $country->getCode());
    }

    public function testAStateMadeOnTheFlyTakesItsNameAsCodeCutToTheColumn(): void
    {
        $this->registry->addOrUpdate(new SaveCustomer(null, 'Ana', null, 'a@kf.test', '111', [
            new AddressData(null, null, null, new CityData(null, 'Raleigh', new StateData(null, 'North Carolina', null, new CountryData(null, 'USA')))),
        ]));

        $state = current(array_filter($this->locations->added, static fn ($l) => $l instanceof State));
        self::assertSame('North Caro', $state->getCode(), 'Legacy used the name; the code column holds 10 characters.');
    }

    public function testACityOfAnotherStateWithTheSameNameIsNotReused(): void
    {
        $country = $this->locations->country('USA');
        $florida = $this->locations->stateOf($country, 'Florida');
        $this->locations->cityOf($florida, 'Springfield');

        $customer = $this->registry->addOrUpdate(new SaveCustomer(null, 'Ana', null, 'a@kf.test', '111', [
            new AddressData(null, null, null, new CityData(null, 'Springfield', new StateData(null, 'Illinois', 'IL', new CountryData(null, 'USA')))),
        ]));

        $city = $customer->getAddresses()->first()->getCity();
        self::assertSame('Illinois', $city->getState()->getName());
        self::assertSame($country, $city->getState()->getCountry(), 'The existing USA is reused.');
    }
}

final class InMemoryCustomers implements CustomerRepository
{
    /** @var array<int, Customer> */
    public array $byId = [];
    /** @var list<Customer> */
    public array $added = [];

    public function has(int $id, string $email, string $phone): Customer
    {
        $customer = new Customer();
        (new \ReflectionProperty(Customer::class, 'id'))->setValue($customer, $id);
        $customer->setEmail($email)->setPhone($phone)->setFirstName('Old')->setLastName('Name');

        return $this->byId[$id] = $customer;
    }

    public function get(int $id): Customer
    {
        return $this->byId[$id] ?? throw new CustomerNotFound();
    }

    public function findByEmail(string $email): ?Customer
    {
        foreach ($this->byId as $customer) {
            if ($customer->getEmail() === $email) {
                return $customer;
            }
        }

        return null;
    }

    public function findByPhone(string $phone): ?Customer
    {
        foreach ($this->byId as $customer) {
            if ($customer->getPhone() === $phone) {
                return $customer;
            }
        }

        return null;
    }

    public function add(Customer $customer): void
    {
        $this->added[] = $customer;
    }

    public function remove(Customer $customer): void
    {
    }
}

final class InMemoryLocations implements LocationRepository
{
    /** @var list<Country|State|City> */
    public array $added = [];
    /** @var list<Country> */
    private array $countries = [];

    public function country(string $name): Country
    {
        $country = new Country();
        $country->setName($name);

        return $this->countries[] = $country;
    }

    public function stateOf(Country $country, string $name): State
    {
        $state = new State();
        $state->setName($name);
        $country->addState($state);

        return $state;
    }

    public function cityOf(State $state, string $name): City
    {
        $city = new City();
        $city->setName($name);
        $state->addCity($city);

        return $city;
    }

    public function findCountry(?int $id, ?string $nameOrCode): ?Country
    {
        foreach ([...$this->countries, ...array_filter($this->added, static fn ($l) => $l instanceof Country)] as $country) {
            if (null !== $nameOrCode && (0 === strcasecmp((string) $country->getName(), $nameOrCode) || 0 === strcasecmp((string) $country->getCode(), $nameOrCode))) {
                return $country;
            }
        }

        return null;
    }

    public function findState(?int $id, ?string $nameOrCode): ?State
    {
        return null;
    }

    public function findCity(?int $id, ?string $name): ?City
    {
        return null;
    }

    public function add(Country|State|City $location): void
    {
        $this->added[] = $location;
    }
}
