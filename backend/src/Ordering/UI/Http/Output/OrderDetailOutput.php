<?php

namespace App\Ordering\UI\Http\Output;

use App\Customers\UI\Http\Output\CustomerOutput;
use App\Inventory\UI\Http\Output\WarehouseRefOutput;

/**
 * An order with its customer (and addresses), comments and products: the detail modal and the edit form.
 */
final readonly class OrderDetailOutput
{
    /**
     * @param list<OrderCommentOutput> $comments
     * @param list<OrderLineOutput>    $products
     */
    public function __construct(
        public int $id,
        public ?string $code,
        public int $status,
        public int $source,
        public ?int $paymentMethod,
        public ?string $comment,
        /** ISO 8601 */
        public ?string $createdAt,
        public ?WarehouseRefOutput $warehouse,
        public ?CustomerOutput $customer,
        public array $comments,
        public array $products,
        /** The shop connection the order came from (shop_order_link); null for orders typed here or imported before connections */
        public ?ShopRefOutput $shop,
        public ?PinnedCommentOutput $pinnedComment,
    ) {
    }
}
