<?php

namespace App\Model;

use App\Validator\Constraint as CustomAssert;
use Symfony\Component\Validator\Constraints as Assert;

class RemoveOrderInput
{
    /**
     * @Assert\NotBlank()
     * @CustomAssert\OrderExistById()
     *
     * @var string
     */
    public $order;

    /**
     * @Assert\NotBlank()
     *
     * @var string
     */
    public $token;

    public static function createFormInput(array $removeOrderData): self
    {
        $new = new self();
        $new->order = $removeOrderData['order'];
        $new->token = $removeOrderData['token'];

        return $new;
    }
}
