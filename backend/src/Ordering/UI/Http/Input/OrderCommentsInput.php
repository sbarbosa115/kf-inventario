<?php

namespace App\Ordering\UI\Http\Input;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * An order's comments as they should be: new ones (no id) are added, missing ones removed.
 */
final class OrderCommentsInput
{
    /** @var list<OrderCommentInput> */
    #[Assert\Valid]
    public array $comments = [];
}
