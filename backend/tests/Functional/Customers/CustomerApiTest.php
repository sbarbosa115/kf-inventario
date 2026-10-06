<?php

namespace App\Tests\Functional\Customers;

use App\Customers\Domain\Model\City;
use App\Customers\Domain\Model\Country;
use App\Customers\Domain\Model\Customer;
use App\Customers\Domain\Model\CustomerAddress;
use App\Customers\Domain\Model\State;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use PHPUnit\Framework\Attributes\DataProvider;

final class CustomerApiTest extends ApiTestCase
{
    use SignsIn;

    public function testTheListIsPagedNewestFirstWithTheListContract(): void
    {
        $this->signInAs(['ROLE_MANAGE_CUSTOMERS', 'ROLE_USER']);
        $before = (int) $this->em()->createQuery('SELECT COUNT(c.id) FROM '.Customer::class.' c')->getSingleScalarResult();
        $em = $this->em();
        for ($i = 0; $i < 101; ++$i) {
            $em->persist($this->customer("Pager $i", "pager$i@kf.test", "9$i"));
        }
        $em->flush();
        $em->clear();
        $total = $before + 101;

        $first = $this->getJson('/api/v1/customers?page=1&per_page=100');

        $this->assertStatus(200);
        self::assertSame($total, $first['total']);
        self::assertSame(1, $first['page']);
        self::assertSame(100, $first['per_page']);
        self::assertCount(100, $first['items']);
        self::assertSame('Pager 100', $first['items'][0]['first_name'], 'Newest first (docs/pdr/prd-shops-settings.md: default sort -id).');
        $second = $this->getJson('/api/v1/customers?page=2&per_page=100');
        self::assertCount($total - 100, $second['items'], 'Page 2 holds what is left after the first 100.');

        $default = $this->getJson('/api/v1/customers');
        self::assertCount(25, $default['items'], 'A page is 25 customers when nothing else is asked.');
        $this->getJson('/api/v1/customers?per_page=101');
        $this->assertStatus(422, 'A page never holds more than 100.');
        $this->getJson('/api/v1/customers?q=pager10%40kf');
        self::assertSame(['Pager 10'], array_column($this->body()['items'], 'first_name'), 'q searches the email.');
    }

    public function testACustomerComesWithItsAddressesAndWhereTheyAre(): void
    {
        $this->signInAs(['ROLE_MANAGE_CUSTOMERS', 'ROLE_USER']);
        $customer = $this->customerWithAddress();

        $body = $this->getJson('/api/v1/customers/'.$customer->getId());

        $this->assertStatus(200);
        self::assertSame($customer->getId(), $body['id']);
        self::assertSame('Ana', $body['first_name']);
        self::assertSame('Diaz', $body['last_name']);
        self::assertSame('ana@kf.test', $body['email']);
        self::assertSame('555', $body['phone']);
        $address = $body['addresses'][0];
        self::assertSame(['id', 'address', 'zip_code', 'address_type', 'city'], array_keys($address));
        self::assertSame('1 Main St', $address['address']);
        self::assertSame('33100', $address['zip_code']);
        self::assertSame(1, $address['address_type']);
        self::assertSame('Miami', $address['city']['name']);
        self::assertSame('Florida', $address['city']['state']['name']);
        self::assertSame('FL', $address['city']['state']['code']);
        self::assertSame('USA', $address['city']['state']['country']['name']);
    }

    public function testAnUnknownCustomerIsNotFound(): void
    {
        $this->signInAs(['ROLE_MANAGE_CUSTOMERS', 'ROLE_USER']);

        $body = $this->getJson('/api/v1/customers/99999999');

        $this->assertStatus(404);
        self::assertSame('customer_not_found', $body['error']);
        $this->sendJson('PUT', '/api/v1/customers/99999999', ['first_name' => 'A', 'email' => 'a@kf.test']);
        $this->assertStatus(404, 'Editing nobody is a 404 too, not a new customer.');
        $this->sendJson('DELETE', '/api/v1/customers/99999999');
        $this->assertStatus(404);
    }

    public function testTheListForPickersAlsoHoldsCustomersWithoutAnAddress(): void
    {
        $this->signInAs(['ROLE_MANAGE_CUSTOMERS', 'ROLE_USER']);
        $this->save($this->customer('Bare', 'bare@kf.test', '1'));
        $this->customerWithAddress();

        $all = $this->getJson('/api/v1/customers/all');

        $this->assertStatus(200);
        $emails = array_column($all, 'email');
        self::assertContains('bare@kf.test', $emails, 'A customer without an address is not hidden from the pickers.');
        self::assertContains('ana@kf.test', $emails);
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function pickerRoles(): iterable
    {
        yield 'the customers screen' => ['ROLE_MANAGE_CUSTOMERS'];
        yield 'the legacy new-order page' => ['ROLE_CAN_CREATE_ORDERS'];
        yield 'the legacy edit-order page' => ['ROLE_CAN_UPDATE_ORDERS'];
        yield 'the legacy new-invoice page' => ['ROLE_CAN_CREATE_INVOICES'];
    }

    #[DataProvider('pickerRoles')]
    public function testEveryoneWhoseLegacyFormEmbeddedTheCustomerListReadsIt(string $role): void
    {
        $this->signInAs([$role, 'ROLE_USER']);
        $this->save($this->customer('Picked', 'picked@kf.test', '1'));

        $all = $this->getJson('/api/v1/customers/all');

        $this->assertStatus(200, "The legacy order and invoice forms embedded every customer for {$role}: the picker must keep working.");
        self::assertContains('picked@kf.test', array_column($all, 'email'));
    }

    public function testTheListForPickersIsRefusedToAnAccountWithNoFormThatShowsIt(): void
    {
        $this->signInAs(['ROLE_USER']);

        $this->getJson('/api/v1/customers/all');

        $this->assertStatus(403, 'Only the customers screen and the order and invoice forms list every customer.');
    }

    public function testCreatingWithANewCityStateAndCountryCreatesThemOnce(): void
    {
        $this->signInAs(['ROLE_MANAGE_CUSTOMERS', 'ROLE_USER']);
        $place = ['name' => 'Arequipa', 'state' => ['name' => 'Arequipa Region', 'code' => 'ARE', 'country' => ['name' => 'Peruvia', 'code' => 'PV']]];

        $body = $this->sendJson('POST', '/api/v1/customers', [
            'first_name' => 'Luz', 'last_name' => 'Rios', 'email' => 'luz@kf.test', 'phone' => '777',
            'addresses' => [
                ['address' => '1 Sol', 'zip_code' => '04001', 'address_type' => 1, 'city' => $place],
                ['address' => '2 Luna', 'zip_code' => '04002', 'address_type' => 2, 'city' => $place],
            ],
        ]);

        $this->assertStatus(201);
        self::assertIsInt($body['id']);
        self::assertCount(2, $body['addresses']);
        self::assertSame($body['addresses'][0]['city']['id'], $body['addresses'][1]['city']['id'], 'Both addresses share the one new city.');
        self::assertSame('Peruvia', $body['addresses'][0]['city']['state']['country']['name']);
        self::assertSame('PV', $body['addresses'][0]['city']['state']['country']['code']);
        self::assertSame(1, $this->rowsNamed(Country::class, 'Peruvia'), 'The new country is created once.');
        self::assertSame(1, $this->rowsNamed(State::class, 'Arequipa Region'), 'The new state is created once.');
        self::assertSame(1, $this->rowsNamed(City::class, 'Arequipa'), 'The new city is created once.');

        // Typing the same names again finds them instead of making more.
        $this->sendJson('POST', '/api/v1/customers', [
            'first_name' => 'Pedro', 'email' => 'pedro@kf.test', 'phone' => '778',
            'addresses' => [['address' => '3 Sol', 'city' => $place]],
        ]);
        $this->assertStatus(201);
        self::assertSame(1, $this->rowsNamed(Country::class, 'Peruvia'));
        self::assertSame(1, $this->rowsNamed(City::class, 'Arequipa'));
    }

    public function testAnExistingCityIsPickedById(): void
    {
        $this->signInAs(['ROLE_MANAGE_CUSTOMERS', 'ROLE_USER']);
        $city = $this->customerWithAddress()->getAddresses()->first()->getCity();

        $body = $this->sendJson('POST', '/api/v1/customers', [
            'first_name' => 'Eva', 'email' => 'eva@kf.test', 'phone' => '1',
            'addresses' => [['address' => 'x', 'city' => ['id' => $city->getId()]]],
        ]);

        $this->assertStatus(201);
        self::assertSame($city->getId(), $body['addresses'][0]['city']['id']);
        self::assertSame('Miami', $body['addresses'][0]['city']['name']);
    }

    public function testACustomerNeedsAFirstNameAndAnEmail(): void
    {
        $this->signInAs(['ROLE_MANAGE_CUSTOMERS', 'ROLE_USER']);

        $body = $this->sendJson('POST', '/api/v1/customers', ['last_name' => 'Only', 'phone' => '1']);

        $this->assertStatus(422);
        self::assertSame('validation_failed', $body['error']);
        self::assertEqualsCanonicalizing(['first_name', 'email'], array_column($body['violations'], 'field'));
    }

    public function testPostingAnExistingEmailEditsThatCustomerAsTheLegacyFormDid(): void
    {
        $this->signInAs(['ROLE_MANAGE_CUSTOMERS', 'ROLE_USER']);
        $ana = $this->customerWithAddress();

        $body = $this->sendJson('POST', '/api/v1/customers', ['first_name' => 'Anita', 'email' => 'ana@kf.test', 'phone' => '555']);

        $this->assertStatus(201);
        self::assertSame($ana->getId(), $body['id'], 'The id, then the email, then the phone find the customer.');
        self::assertSame('Anita', $body['first_name']);
    }

    public function testUpdatingReplacesTheAddressSet(): void
    {
        $this->signInAs(['ROLE_MANAGE_CUSTOMERS', 'ROLE_USER']);
        $customer = $this->customerWithAddress();
        $id = $customer->getId();
        $cityId = $customer->getAddresses()->first()->getCity()->getId();

        $body = $this->sendJson('PUT', "/api/v1/customers/$id", [
            'first_name' => 'Ana María', 'last_name' => 'Diaz', 'email' => 'ana@kf.test', 'phone' => '556',
            'addresses' => [
                ['address' => '9 New Rd', 'zip_code' => '1', 'address_type' => 2, 'city' => ['id' => $cityId]],
                ['address' => '10 New Rd', 'city' => ['id' => $cityId]],
            ],
        ]);

        $this->assertStatus(200);
        self::assertSame($id, $body['id']);
        self::assertSame('Ana María', $body['first_name']);
        self::assertSame(['9 New Rd', '10 New Rd'], array_column($body['addresses'], 'address'));
        $this->em()->clear();
        $rows = $this->em()->getConnection()->fetchFirstColumn('SELECT address FROM customer_address WHERE customer_id = ? ORDER BY id', [$id]);
        self::assertSame(['9 New Rd', '10 New Rd'], $rows, 'The old address row is deleted, not left behind.');
        self::assertSame('556', $this->getJson("/api/v1/customers/$id")['phone']);
    }

    public function testDeletingSoftDeletesTheCustomer(): void
    {
        $this->signInAs(['ROLE_MANAGE_CUSTOMERS', 'ROLE_USER']);
        $id = $this->customerWithAddress()->getId();

        $this->client->request('DELETE', "/api/v1/customers/$id");

        $this->assertStatus(204);
        $deletedAt = $this->em()->getConnection()->fetchOne('SELECT deleted_at FROM customer WHERE id = ?', [$id]);
        self::assertNotFalse($deletedAt, 'The row stays.');
        self::assertNotNull($deletedAt, 'It is marked deleted (deleted_at), not removed.');
        $this->getJson("/api/v1/customers/$id");
        $this->assertStatus(404, 'A deleted customer is gone for the API.');
        self::assertNotContains($id, array_column($this->getJson('/api/v1/customers/all'), 'id'));
        $log = $this->em()->getConnection()->fetchOne("SELECT event FROM log WHERE entity = 'customer' ORDER BY id DESC LIMIT 1");
        self::assertSame('Customer ana@kf.test was deleted', $log, 'The activity log says who is gone.');
    }

    public function testAccountsWithoutTheRoleAreRefused(): void
    {
        $this->signInAs(['ROLE_USER']);

        $this->getJson('/api/v1/customers');
        $this->assertStatus(403, 'ROLE_MANAGE_CUSTOMERS opens the customer endpoints.');
        $this->sendJson('POST', '/api/v1/customers', ['first_name' => 'A', 'email' => 'a@kf.test']);
        $this->assertStatus(403);
        $this->sendJson('DELETE', '/api/v1/customers/1');
        $this->assertStatus(403);
        $this->getJson('/api/v1/locations');
        $this->assertStatus(200, 'Any signed-in user reads the locations.');
    }

    private function customer(string $first, string $email, string $phone): Customer
    {
        return (new Customer())->setFirstName($first)->setLastName('Test')->setEmail($email)->setPhone($phone);
    }

    private function customerWithAddress(): Customer
    {
        $country = (new Country())->setName('USA')->setCode('US');
        $state = (new State())->setName('Florida')->setCode('FL');
        $country->addState($state);
        $city = (new City())->setName('Miami');
        $state->addCity($city);
        $customer = (new Customer())->setFirstName('Ana')->setLastName('Diaz')->setEmail('ana@kf.test')->setPhone('555');
        $customer->addAddress((new CustomerAddress())->setAddress('1 Main St')->setZipCode('33100')->setAddressType(1)->setCity($city));
        $this->save($country, $state, $city, $customer);

        return $this->em()->getRepository(Customer::class)->findOneBy(['email' => 'ana@kf.test']);
    }

    /**
     * @param class-string $class
     */
    private function rowsNamed(string $class, string $name): int
    {
        return (int) $this->em()->createQuery("SELECT COUNT(x.id) FROM $class x WHERE x.name = :n")->setParameter('n', $name)->getSingleScalarResult();
    }
}
