<?php

namespace App\Ordering\UI\Http\Output;

/** An order's pinned comment, as the list's Notes column and the detail's top card show it. */
final readonly class PinnedCommentOutput
{
    public function __construct(
        public int $id,
        public string $content,
        /** ISO 8601; the order's date when the comment has none (legacy rows) */
        public ?string $createdAt,
    ) {
    }
}
