<?php

namespace App\Ordering\UI\Http\Output;

/**
 * A comment on an order.
 */
final readonly class OrderCommentOutput
{
    public function __construct(
        public int $id,
        public ?string $content,
    ) {
    }
}
