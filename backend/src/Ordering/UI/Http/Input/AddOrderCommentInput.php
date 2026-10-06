<?php

namespace App\Ordering\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/** A comment added from the timeline: typed, or a quick phrase; optionally sent to the shop as an order note. */
final class AddOrderCommentInput
{
    #[Assert\NotBlank]
    #[Assert\Length(max: 10000)]
    public string $content = '';

    public bool $sendToShop = false;

    #[Assert\Positive]
    public ?int $phraseId = null;
}
