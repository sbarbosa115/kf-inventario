<?php

namespace App\Ordering\UI\Http\Output;

/** What the app may write back to the shop, one switch each (ShopCapability). */
final readonly class ShopCapabilitiesOutput
{
    public function __construct(
        /** Processed → processing, Sent and Delivered → completed */
        public bool $orderStatus,
        /** Comments marked "also send to the shop" */
        public bool $orderNote,
    ) {
    }
}
