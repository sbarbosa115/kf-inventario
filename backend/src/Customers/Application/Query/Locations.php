<?php

namespace App\Customers\Application\Query;

use App\Customers\Domain\Model\Country;

interface Locations
{
    /**
     * Every country that has a state, with its states and their cities, all by id.
     *
     * @return list<Country>
     */
    public function tree(): array;
}
