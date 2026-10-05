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
