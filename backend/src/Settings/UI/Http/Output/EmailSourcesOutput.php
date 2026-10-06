<?php

namespace App\Settings\UI\Http\Output;

/** Where each effective email value comes from: `settings`, `env` (backend/.env.local) or `none`. */
final readonly class EmailSourcesOutput
{
    public function __construct(
        public string $dsn,
        public string $from,
        public string $printer,
        public string $cc,
    ) {
    }
}
