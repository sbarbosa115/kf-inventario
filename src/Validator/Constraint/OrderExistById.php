<?php

namespace App\Validator\Constraint;

use Symfony\Component\Validator\Constraint;

/**
 * @Annotation
 * @Target({"PROPERTY", "METHOD", "ANNOTATION"})
 */
class OrderExistById extends Constraint
{
    public $message = 'The given uuid does not exist on the database';
}
