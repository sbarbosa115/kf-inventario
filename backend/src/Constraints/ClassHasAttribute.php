<?php

namespace App\Constraints;

use Symfony\Component\Validator\Constraint;

#[\Attribute(\Attribute::TARGET_CLASS | \Attribute::TARGET_PROPERTY | \Attribute::TARGET_METHOD)]
class ClassHasAttribute extends Constraint
{
    public string $message = 'The given attribute does not match with any on this class.';
}
