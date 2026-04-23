<?php

namespace App\Validator\Constraint;

use Symfony\Component\Validator\Constraint;

#[\Attribute(\Attribute::TARGET_PROPERTY | \Attribute::TARGET_METHOD)]
class OrderExistById extends Constraint
{
    public string $message = 'The given uuid does not exist on the database';
}
