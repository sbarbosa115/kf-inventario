<?php

namespace App\Model;

use Symfony\Component\Validator\Constraints as Assert;

class WarehouseInput
{
    public mixed $id = null;

    #[Assert\NotBlank]
    public mixed $name = null;

    public static function createFormInput(array $warehouseData): self
    {
        $new = new self();
        $new->id = $warehouseData['id'];
        $new->name = $warehouseData['name'];

        return $new;
    }
}
