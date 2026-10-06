<?php

namespace App\Ordering\Application\Port;

/** The shop an order came from, as lists and details name it. */
final readonly class ShopRef
{
    public function __construct(
        public int $id,
        public string $name,
        /** The connection is active and may receive order notes (the "send to the shop" box). */
        public bool $takesNotes = false,
    ) {
    }
}
