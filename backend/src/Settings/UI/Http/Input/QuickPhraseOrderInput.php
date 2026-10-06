<?php

namespace App\Settings\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/** The phrases' ids in their new order. */
final class QuickPhraseOrderInput
{
    /** @var list<int> */
    #[Assert\NotNull]
    #[Assert\All([new Assert\Positive()])]
    public array $ids = [];
}
