<?php

namespace App\Ordering\UI\Http\Output;

/** The shop connection an order came from. */
final readonly class ShopRefOutput
{
    public function __construct(
        public int $id,
        public string $name,
        /** The connection is active and takes order notes: a comment can be sent to the shop. */
        public bool $takesNotes = false,
    ) {
    }
}
