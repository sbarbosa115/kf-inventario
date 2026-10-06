<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\InvalidValue;

/** A comment of nothing but spaces and line breaks. */
final class EmptyComment extends InvalidValue
{
    public function __construct()
    {
        parent::__construct('content', 'This value should not be blank.');
    }
}
