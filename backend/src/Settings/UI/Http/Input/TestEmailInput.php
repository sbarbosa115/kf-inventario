<?php

namespace App\Settings\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

final class TestEmailInput
{
    #[Assert\NotBlank]
    #[Assert\Email]
    public string $to = '';
}
