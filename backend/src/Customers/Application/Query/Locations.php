<?php

namespace App\Customers\Application\Query;

interface Locations
{
    /**
     * Every country that has a state, with its states and their cities, all by id.
     *
     * @return list<array{id: int, name: string, code: ?string, states: list<array{id: int, name: string, code: ?string, cities: list<array{id: int, name: string}>}>}>
     */
    public function tree(): array;
}
