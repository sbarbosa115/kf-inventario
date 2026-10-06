<?php

namespace App\Settings\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

final class QuickPhraseInput
{
    #[Assert\NotBlank]
    #[Assert\Length(max: 255)]
    public string $text = '';

    public bool $active = true;
}
