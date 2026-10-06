<?php

namespace App\Customers\UI\Http\Input;

use App\Customers\Application\Command\CountryData;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * An address's country: an existing one by id, or a name (and code) to find or create.
 */
final class CountryInput
{
    public ?int $id = null;

    #[Assert\Length(max: 255)]
    public ?string $name = null;

    #[Assert\Length(max: 10)]
    public ?string $code = null;

    public function toData(): CountryData
    {
        return new CountryData($this->id, $this->name, $this->code);
    }
}
