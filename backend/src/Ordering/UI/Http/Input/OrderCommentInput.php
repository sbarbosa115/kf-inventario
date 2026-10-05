<?php

namespace App\Ordering\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * A comment; an id edits an existing one.
 */
final class OrderCommentInput
{
    public ?int $id = null;

    #[Assert\NotBlank]
    public string $content = '';
}
