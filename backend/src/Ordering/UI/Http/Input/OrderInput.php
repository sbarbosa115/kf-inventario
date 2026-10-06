<?php

namespace App\Ordering\UI\Http\Input;

use App\Customers\UI\Http\Input\CustomerInput;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * An order placed or edited by hand.
 */
final class OrderInput
{
    #[Assert\Length(max: 255)]
    public ?string $code = null;

    #[Assert\Choice(choices: [1, 2, 3, 4, 5, 6])]
    public int $status = 1;

    #[Assert\Choice(choices: [1, 2])]
    public int $source = 2;

    #[Assert\Choice(choices: [1, 2])]
    public ?int $paymentMethod = null;

    public ?string $comment = null;

    #[Assert\Positive]
    public int $warehouseId = 0;

    #[Assert\NotNull]
    #[Assert\Valid]
    public ?CustomerInput $customer = null;

    /** @var list<OrderLineInput> */
    #[Assert\Valid]
    public array $products = [];

    /** @var list<OrderCommentInput> */
    #[Assert\Valid]
    public array $comments = [];
}
