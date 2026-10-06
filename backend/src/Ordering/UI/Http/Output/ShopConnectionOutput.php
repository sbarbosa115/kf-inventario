<?php

namespace App\Ordering\UI\Http\Output;

use App\Inventory\UI\Http\Output\WarehouseRefOutput;

/**
 * A shop connection (docs/pdr/prd-shops-settings.md, "Shop connections"). Never its REST keys (`has_keys`); the
 * webhook secret only right after creating the connection (`webhook_secret`, null otherwise: GET …/webhook-secret).
 */
final readonly class ShopConnectionOutput
{
    public function __construct(
        public int $id,
        public string $name,
        public string $siteUrl,
        public bool $active,
        public WarehouseRefOutput $warehouse,
        public bool $emailPrinter,
        public ShopCapabilitiesOutput $capabilities,
        /** The connection's own webhook URL, to paste in WooCommerce */
        public string $webhookUrl,
        public bool $hasKeys,
        public ShopHealthOutput $health,
        /** Only in the answer that created the connection */
        public ?string $webhookSecret,
    ) {
    }
}
