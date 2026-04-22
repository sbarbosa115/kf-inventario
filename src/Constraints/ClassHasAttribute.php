<?php

namespace App\Constraints;

use Symfony\Component\Validator\Constraint;

class ClassHasAttribute extends Constraint
{
    /**
     * @Annotation
     */
    public $message = 'The given attribute does not match with any on this class.';
}
