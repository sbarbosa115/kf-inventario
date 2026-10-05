<?php

namespace App\Ordering\UI\Http\Output;

/**
 * The product of a shipped line.
 */
final readonly class PartialLineProductOutput
{
    public function __construct(
        public string $code,
    ) {
    }
}
