<?php

namespace App\Tests\Functional\Customers;

use App\Customers\Domain\Model\City;
use App\Customers\Domain\Model\Country;
use App\Customers\Domain\Model\State;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * GET /api/v1/customers in SQL (docs/pdr/prd-shops-settings.md, "List query contract", item 1; FLT-05): 1,240
 * customers, as production holds, filtered by name, email, phone, city (the first address's, the one the list shows)
 * and country (any address), sorted, paged newest first, with the country counts.
 */
final class CustomersListApiTest extends ApiTestCase
{
    use SignsIn;

    private const SEEDED = 1240;

    private int $colombia;
    private int $usa;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signInAs(['ROLE_MANAGE_CUSTOMERS', 'ROLE_USER']);
        $this->seed();
    }

    /**
     * 1,240 customers c0001 … c1240 (@seed.test): every fourth one lives in Medellin (Colombia), the others in Miami
     * (USA); c0007's second address is in Cali (Colombia). Written in two statements, inside the test's transaction.
     */
    private function seed(): void
    {
        $colombia = (new Country())->setName('Colombia')->setCode('CO');
        $antioquia = (new State())->setName('Antioquia')->setCode('ANT');
        $colombia->addState($antioquia);
        $medellin = (new City())->setName('Medellin');
        $cali = (new City())->setName('Cali');
        $antioquia->addCity($medellin);
        $antioquia->addCity($cali);
        $usa = (new Country())->setName('USA')->setCode('US');
        $florida = (new State())->setName('Florida')->setCode('FL');
        $usa->addState($florida);
        $miami = (new City())->setName('Miami');
        $florida->addCity($miami);
        $this->save($colombia, $antioquia, $medellin, $cali, $usa, $florida, $miami);
        $this->colombia = (int) $colombia->getId();
        $this->usa = (int) $usa->getId();

        $db = $this->em()->getConnection();
        $first = (int) $db->fetchOne('SELECT COALESCE(MAX(id), 0) FROM customer') + 1;
        $customers = [];
        $addresses = [];
        for ($i = 1; $i <= self::SEEDED; ++$i) {
            $id = $first + $i - 1;
            $n = \sprintf('%04d', $i);
            $customers[] = \sprintf("(%d, 'Name%s', 'Seeded', 'c%s@seed.test', '300%s')", $id, $n, $n, $n);
            $addresses[] = \sprintf("(%d, %d, 'Street %s', 1)", $id, 0 === $i % 4 ? $medellin->getId() : $miami->getId(), $n);
        }
        $addresses[] = \sprintf("(%d, %d, 'Second street', 2)", $first + 6, $cali->getId());
        $db->executeStatement('INSERT INTO customer (id, first_name, last_name, email, phone) VALUES '.implode(', ', $customers));
        $db->executeStatement('INSERT INTO customer_address (customer_id, city_id, address, address_type) VALUES '.implode(', ', $addresses));
    }

    /**
     * @return array<mixed>
     */
    private function list(string $query): array
    {
        $body = $this->getJson('/api/v1/customers?'.$query);
        $this->assertStatus(200, $query);

        return $body;
    }

    /**
     * @return list<string>
     */
    private function emails(string $query): array
    {
        return array_column($this->list($query)['items'], 'email');
    }

    public function testAFilterFindsACustomerTheDefaultOrderPutsOnPageThirteen(): void
    {
        $seeded = 'filter[email]=%40seed.test&per_page=100';
        $first = $this->list($seeded);
        self::assertSame(self::SEEDED, $first['total'], 'Every seeded customer.');
        self::assertCount(100, $first['items']);
        self::assertSame('c1240@seed.test', $first['items'][0]['email'], 'Newest first.');

        $last = $this->list($seeded.'&page=13');
        self::assertCount(40, $last['items'], '1,240 customers: 12 full pages and 40 on the 13th.');
        self::assertContains('c0007@seed.test', array_column($last['items'], 'email'), 'c0007 is on page 13 unfiltered.');

        $found = $this->list('filter[email]=C0007%40SEED');
        self::assertSame(['c0007@seed.test'], array_column($found['items'], 'email'), 'The filter finds it on the first page, any case.');
        self::assertSame(1, $found['total']);
        $addresses = $found['items'][0]['addresses'];
        self::assertSame(['Miami', 'Cali'], array_map(static fn (array $a) => $a['city']['name'], $addresses), 'The customer comes with every address, in order.');
        self::assertSame('Colombia', $addresses[1]['city']['state']['country']['name']);
    }

    public function testCityAndCountryFiltersAndTheCountryFacet(): void
    {
        $medellin = $this->list('filter[city]=medell&per_page=1');
        self::assertSame(310, $medellin['total'], 'Every fourth customer lives in Medellin.');

        self::assertSame(['c0007@seed.test'], $this->emails('filter[email]=%40seed&filter[country][]='.$this->colombia.'&filter[city]=miami'), "c0007 lives in Miami and has an address in Colombia: the country is any address's.");
        self::assertSame([], $this->emails('filter[city]=cali'), 'The city is the first address\'s, the one the list shows.');

        $colombia = $this->list('filter[country][]='.$this->colombia.'&per_page=1&facets=country');
        self::assertSame(311, $colombia['total']);
        self::assertSame(
            [['value' => (string) $this->colombia, 'count' => 311], ['value' => (string) $this->usa, 'count' => 930]],
            $colombia['facets']['country'],
            'The country counts ignore the country filter; a customer counts once per country it has an address in.',
        );
        $both = $this->list('filter[country][]='.$this->colombia.'&filter[country][]='.$this->usa.'&per_page=1');
        self::assertSame(self::SEEDED, $both['total'], 'Any of the countries; c0007 once.');

        $narrow = $this->list('filter[city]=medell&per_page=1&facets=country');
        self::assertSame([['value' => (string) $this->colombia, 'count' => 310]], $narrow['facets']['country'], 'Counted over the other filters.');
    }

    public function testNamePhoneAndQ(): void
    {
        self::assertSame(['c0012@seed.test'], $this->emails('filter[name]=name0012'));
        self::assertSame(['c0012@seed.test'], $this->emails('filter[name]=Name0012%20Seeded'), 'The full name.');
        self::assertSame(['c0013@seed.test'], $this->emails('filter[phone]=3000013'));
        self::assertSame(['c0014@seed.test'], $this->emails('q=c0014%40'), 'q looks in the email.');
        self::assertSame(['c0015@seed.test'], $this->emails('q=3000015'), 'q looks in the phone.');
        self::assertSame(310, $this->list('q=medellin&per_page=1')['total'], 'q looks in the city.');
        self::assertSame(['c0016@seed.test'], $this->emails('q=name0016'), 'q looks in the name.');
        self::assertSame([], $this->emails('filter[name]=name00%25'), '% is not a wildcard.');
    }

    public function testSortsComeFromTheAllowList(): void
    {
        self::assertSame(['c0001@seed.test', 'c0002@seed.test'], $this->emails('filter[email]=%40seed&sort=name&per_page=2'));
        self::assertSame(['c1240@seed.test', 'c1239@seed.test'], $this->emails('filter[email]=%40seed&sort=-email&per_page=2'));
        self::assertSame(['c0004@seed.test', 'c0008@seed.test'], $this->emails('filter[email]=%40seed&sort=city&per_page=2'), 'Medellin before Miami, then by id.');

        $body = $this->getJson('/api/v1/customers?sort=phone');
        $this->assertStatus(422);
        self::assertSame(['sort'], array_column($body['violations'], 'field'));
        $this->getJson('/api/v1/customers?per_page=0');
        $this->assertStatus(422, 'Every row at once is for the stock pickers only.');
        $this->getJson('/api/v1/customers?filter[country][]=CO');
        $this->assertStatus(422, 'A country is its id.');
    }
}
