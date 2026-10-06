<?php

namespace App\Ordering\UI\Http\Output;

/** Who wrote a comment, or pinned it. */
final readonly class CommentAuthorOutput
{
    public function __construct(
        public int $id,
        public string $name,
    ) {
    }
}
