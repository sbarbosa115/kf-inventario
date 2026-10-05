<?php

namespace App\Ordering\Application\Port;

use App\Ordering\Domain\Error\OrderSyncFailed;

/**
 * The WooCommerce shops' REST API, read for the "Sync Orders" button: which shops the app holds credentials for, and
 * the orders each one has waiting. A shop is named by the address its webhooks come from (one of a warehouse's
 * `urls`), so a pulled order lands in the same warehouse a webhook would have put it in.
 */
interface RemoteOrderSource
{
    /**
     * The shops this app can read (it holds their REST API keys). A warehouse whose shop is not among them is not
     * pulled.
     *
     * @return list<string>
     */
    public function shops(): array;

    /**
     * The shop's orders waiting to be fulfilled, each as WooCommerce's REST API returns it: the same JSON the webhook
     * posts.
     *
     * @return list<array<mixed>>
     *
     * @throws OrderSyncFailed the shop could not be read (down, wrong keys, not WooCommerce)
     */
    public function ordersOf(string $shop): array;
}
