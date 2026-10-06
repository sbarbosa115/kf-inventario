<?php

namespace App\Ordering\UI\Http\Output;

/**
 * A comment on an order, as the timeline shows it (docs/pdr/prd-shops-settings.md, "Comments").
 */
final readonly class OrderCommentOutput
{
    public function __construct(
        public int $id,
        public ?string $content,
        /** ISO 8601; a legacy comment without a date carries the order's, with `approximate` */
        public ?string $createdAt,
        /** true when created_at is the order's date, not the comment's */
        public bool $approximate,
        /** null for a shop note, or a legacy comment without a user */
        public ?CommentAuthorOutput $author,
        /** app (typed here), shop (a note pulled from the shop), phrase (a quick phrase) */
        public string $origin,
        /** the connection a shop note came from */
        public ?ShopRefOutput $shop,
        public bool $pinned,
        /** ISO 8601 */
        public ?string $pinnedAt,
        public ?CommentAuthorOutput $pinnedBy,
        /** the comment was also sent to the order's shop as an order note */
        public bool $sentToShop,
    ) {
    }
}
