<?php

namespace App\Shared\Application\Query;

/** The column contains this text (case-insensitive; % and _ match themselves). */
final readonly class TextFilter implements ListFilter
{
    public function __construct(public string $text)
    {
    }
}
