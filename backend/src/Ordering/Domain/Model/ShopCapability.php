<?php

namespace App\Ordering\Domain\Model;

/**
 * What the app may write back to a shop, one switch each on a connection (docs/pdr/prd-shops-settings.md, Decisions
 * 10). A third capability (stock, prices…) is one case here plus one pusher method.
 */
enum ShopCapability: string
{
    /** Processed → processing; Sent and Delivered → completed. */
    case OrderStatus = 'order_status';
    /** Comments marked "also send to the shop" become order notes. */
    case OrderNote = 'order_note';

    /**
     * Every capability off: the map a new connection starts from.
     *
     * @return array<string, bool>
     */
    public static function none(): array
    {
        return array_fill_keys(array_map(static fn (self $c): string => $c->value, self::cases()), false);
    }
}
