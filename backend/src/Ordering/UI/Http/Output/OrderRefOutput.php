<?php

namespace App\Ordering\UI\Http\Output;

/** An order, named. */
final readonly class OrderRefOutput
{
    public function __construct(
        public int $id,
        public ?string $code,
    ) {
    }
}
