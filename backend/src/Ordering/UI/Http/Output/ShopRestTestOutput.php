<?php

namespace App\Ordering\UI\Http\Output;

/** The REST API part of "Test connection". */
final readonly class ShopRestTestOutput
{
    public function __construct(
        public bool $ok,
        public ?string $storeName,
        public ?string $wcVersion,
        /** null: unknown until a write succeeded (a read cannot prove write access) */
        public ?bool $canWrite,
        /** The shop's message when it failed (never the keys) */
        public ?string $error,
    ) {
    }
}
