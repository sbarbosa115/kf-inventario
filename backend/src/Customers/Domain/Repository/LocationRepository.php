<?php

namespace App\Customers\Domain\Repository;

use App\Customers\Domain\Model\City;
use App\Customers\Domain\Model\Country;
use App\Customers\Domain\Model\State;

/**
 * Countries, their states and their cities: found by id, or by name (a country or state also by its code), and
 * created when an address names one that does not exist yet.
 */
interface LocationRepository
{
    public function findCountry(?int $id, ?string $nameOrCode): ?Country;

    public function findState(?int $id, ?string $nameOrCode): ?State;

    public function findCity(?int $id, ?string $name): ?City;

    public function add(Country|State|City $location): void;
}
