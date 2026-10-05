<?php

namespace App\Customers\UI\Http\Output;

use App\Customers\Domain\Model\Country;

/**
 * A country and its states, in the locations tree the address form picks from.
 */
final readonly class CountryOutput
{
    /**
     * @param list<StateOutput> $states
     */
    public function __construct(
        public int $id,
        public string $name,
        public ?string $code,
        public array $states,
    ) {
    }

    public static function of(Country $country): self
    {
        return new self(
            $country->getId() ?? 0,
            (string) $country->getName(),
            $country->getCode(),
            array_values(array_map(
                static fn ($state) => new StateOutput(
                    $state->getId() ?? 0,
                    (string) $state->getName(),
                    $state->getCode(),
                    array_values(array_map(
                        static fn ($city) => new CityOutput($city->getId() ?? 0, (string) $city->getName()),
                        $state->getCities()->toArray(),
                    )),
                ),
                $country->getStates()->toArray(),
            )),
        );
    }
}
