<?php

namespace App\Ordering\Application\Port;

/**
 * Whether the app may talk to a shop at this address (docs/pdr/prd-shops-settings.md, Security, SSRF): https (http only
 * in dev), no host that is or resolves to a loopback, private, link-local, multicast or reserved address. Checked when a
 * connection is saved or tested, and again at every call (Infrastructure\WooCommerce\SafeShopHttp).
 */
interface ShopUrlGuard
{
    /**
     * @return string|null why the URL is refused, in English for the admin; null when it may be used
     */
    public function refusal(string $siteUrl): ?string;
}
