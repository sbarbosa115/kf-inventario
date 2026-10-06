<?php

namespace App\Inventory\UI\Http\Output;

/**
 * A warehouse and the shop addresses its WooCommerce orders come from.
 */
final readonly class WarehouseOutput
{
    /**
     * @param list<string> $urls
     */
    public function __construct(
        public int $id,
        public string $name,
        /** The X-WC-Webhook-Source values that send orders here */
        public array $urls,
    ) {
    }
}
