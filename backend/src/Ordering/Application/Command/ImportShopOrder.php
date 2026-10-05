<?php

namespace App\Ordering\Application\Command;

/**
 * An order a WooCommerce shop posted to the webhook.
 */
final readonly class ImportShopOrder
{
    /**
     * @param array<mixed> $shopOrder the decoded JSON body
     */
    public function __construct(
        /** The X-WC-Webhook-Source header: the shop's address */
        public ?string $source,
        public array $shopOrder,
    ) {
    }
}
