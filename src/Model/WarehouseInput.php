<?php

namespace App\Model;

use Symfony\Component\Validator\Constraints as Assert;

class WarehouseInput
{
    /**
     * @Assert\Optional()
     *
     * @var int
     */
    public $id;

    /**
     * @Assert\NotBlank()
     *
     * @var string
     */
    public $name;

    public static function createFormInput(array $warehouseData): self
    {
        $new = new self();
        $new->id = $warehouseData['id'];
        $new->name = $warehouseData['name'];

        return $new;
    }
}
