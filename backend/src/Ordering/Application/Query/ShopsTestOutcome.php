<?php

namespace App\Ordering\Application\Query;

/** What "Test connection" learnt: the REST API answered with these keys (and named the shop) or why not. */
final readonly class ShopsTestOutcome
{
    public function __construct(
        public bool $ok,
        public ?string $storeName = null,
        public ?string $wcVersion = null,
        /** null: unknown until a write succeeded; false: a write was refused (read-only keys) */
        public ?bool $canWrite = null,
        public ?string $error = null,
    ) {
    }
}
