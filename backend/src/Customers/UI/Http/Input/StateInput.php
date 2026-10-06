<?php

namespace App\Customers\UI\Http\Input;

use App\Customers\Application\Command\StateData;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * An address's state: an existing one by id, or a name (and code) to find or create in its country.
 */
final class StateInput
{
    public ?int $id = null;

    #[Assert\Length(max: 255)]
    public ?string $name = null;

    #[Assert\Length(max: 10)]
    public ?string $code = null;

    #[Assert\Valid]
    public ?CountryInput $country = null;

    public function toData(): StateData
    {
        return new StateData($this->id, $this->name, $this->code, $this->country?->toData());
    }
}
