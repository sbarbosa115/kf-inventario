<?php

namespace App\Tests\Functional\Customers;

use App\Customers\Domain\Model\City;
use App\Customers\Domain\Model\Country;
use App\Customers\Domain\Model\State;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

final class LocationApiTest extends ApiTestCase
{
    use SignsIn;

    public function testTheTreeListsCountriesStatesAndCitiesById(): void
    {
        $this->signInAs(['ROLE_USER']);
        $peru = $this->country('Peru', 'PE');
        $lima = $this->state($peru, 'Lima', 'LIM');
        $this->city($lima, 'Miraflores');
        $this->city($lima, 'Barranco');
        $this->state($peru, 'Cusco', 'CUS');
        $this->country('Chile', 'CL'); // no state: not in the tree
        $this->em()->flush();
        $this->em()->clear();

        $tree = $this->getJson('/api/v1/locations');

        $this->assertStatus(200);
        self::assertNotContains('Chile', array_column($tree, 'name'), 'A country without a state is left out, as before.');
        $tree = array_values(array_filter($tree, static fn (array $country) => 'Peru' === $country['name']));
        self::assertCount(1, $tree);
        self::assertSame('PE', $tree[0]['code']);
        self::assertIsInt($tree[0]['id']);
        self::assertSame(['Lima', 'Cusco'], array_column($tree[0]['states'], 'name'));
        self::assertSame('LIM', $tree[0]['states'][0]['code']);
        self::assertSame(['Miraflores', 'Barranco'], array_column($tree[0]['states'][0]['cities'], 'name'));
        self::assertSame(['id', 'name'], array_keys($tree[0]['states'][0]['cities'][0]));
        self::assertSame([], $tree[0]['states'][1]['cities'], 'A state without cities is listed with an empty list.');
    }

    public function testTheTreeIsNotCutAtOneHundredCountries(): void
    {
        $this->signInAs(['ROLE_USER']);
        for ($i = 0; $i < 120; ++$i) {
            $this->state($this->country("Country $i", null), "State $i", null);
        }
        $this->em()->flush();
        $this->em()->clear();

        $tree = $this->getJson('/api/v1/locations');

        self::assertGreaterThanOrEqual(120, \count($tree));
    }

    /**
     * Production holds about 22,000 countries, 23,000 states and 26,000 cities (the legacy app made a row per
     * address). Built as Doctrine entities that tree took about 150 MB, past cPanel's 128 MB: a 500 with nothing
     * logged. Read as rows it stays small.
     */
    public function testTheProductionSizedTreeFitsInAModestMemory(): void
    {
        $this->signInAs(['ROLE_USER']);
        $db = $this->em()->getConnection();
        $db->executeStatement('SET SESSION cte_max_recursion_depth = 100000');
        $db->executeStatement("INSERT INTO country (name, code) WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 22000) SELECT CONCAT('Pais ', i), 'CO' FROM n");
        $db->executeStatement("INSERT INTO state (name, country_id) SELECT CONCAT('Depto ', c.id), c.id FROM country c WHERE c.name LIKE 'Pais %'");
        $db->executeStatement("INSERT INTO city (name, state_id) SELECT CONCAT('Ciudad ', s.id), s.id FROM state s WHERE s.name LIKE 'Depto %'");
        $db->executeStatement("INSERT INTO city (name, state_id) SELECT CONCAT('Pueblo ', s.id), s.id FROM state s WHERE s.name LIKE 'Depto %' LIMIT 4000");
        $this->em()->clear();
        gc_collect_cycles();
        memory_reset_peak_usage();
        $before = memory_get_usage();

        $tree = $this->getJson('/api/v1/locations');

        $this->assertStatus(200);
        self::assertGreaterThanOrEqual(22000, \count($tree));
        self::assertLessThan(64 * 1024 * 1024, memory_get_peak_usage() - $before, 'The tree must not need the memory 70,000 entities take.');
        $one = array_values(array_filter($tree, static fn (array $country) => 'Pais 7' === $country['name']))[0];
        self::assertSame(['id', 'name', 'code', 'states'], array_keys($one));
        self::assertSame(['id', 'name', 'code', 'cities'], array_keys($one['states'][0]));
        self::assertStringStartsWith('Ciudad ', $one['states'][0]['cities'][0]['name']);
    }

    private function country(string $name, ?string $code): Country
    {
        $country = (new Country())->setName($name)->setCode($code);
        $this->em()->persist($country);

        return $country;
    }

    private function state(Country $country, string $name, ?string $code): State
    {
        $state = (new State())->setName($name)->setCode($code);
        $country->addState($state);
        $this->em()->persist($state);

        return $state;
    }

    private function city(State $state, string $name): City
    {
        $city = (new City())->setName($name);
        $state->addCity($city);
        $this->em()->persist($city);

        return $city;
    }
}
