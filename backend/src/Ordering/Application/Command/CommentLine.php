<?php

namespace App\Ordering\Application\Command;

/**
 * One comment of an order as the comments tab has it: an id for an existing one, none for a new one.
 */
final readonly class CommentLine
{
    public function __construct(
        public ?int $id,
        public string $content,
    ) {
    }
}
