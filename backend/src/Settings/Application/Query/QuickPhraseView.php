<?php

namespace App\Settings\Application\Query;

final readonly class QuickPhraseView
{
    public function __construct(
        public int $id,
        public string $text,
        public int $position,
        public bool $active,
    ) {
    }
}
