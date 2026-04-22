<?php

namespace App\Validator;

use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\ConstraintValidator;
use Symfony\Component\Validator\Exception\UnexpectedTypeException;

class ClassHasAttributeValidator extends ConstraintValidator
{
    public function validate($value, Constraint $constraint)
    {
        if (!$constraint instanceof ClassHasAttribute) {
            throw new UnexpectedTypeException($constraint, ClassHasAttribute::class);
        }

        if (null === $value || '' === $value) {
            return;
        }
    }
}
