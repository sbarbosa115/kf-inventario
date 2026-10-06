<?php

namespace App\Settings\Application\Command;

/** Adds a phrase at the end (id null) or changes one. */
final readonly class SaveQuickPhrase
{
    public function __construct(
        public ?int $id,
        public string $text,
        public bool $active = true,
    ) {
    }
}
