<?php

namespace App\Shared\Application\Query;

final readonly class Sort
{
    public function __construct(
        public string $field,
        public bool $descending = false,
    ) {
    }

    /** `field` or `-field`. */
    public static function parse(string $sort): self
    {
        return str_starts_with($sort, '-') ? new self(substr($sort, 1), true) : new self($sort);
    }

    public function __toString(): string
    {
        return ($this->descending ? '-' : '').$this->field;
    }
}
