<?php

namespace App\Settings\UI\Http\Output;

final readonly class QuickPhraseOutput
{
    public function __construct(
        public int $id,
        public string $text,
        public int $position,
        public bool $active,
    ) {
    }
}
