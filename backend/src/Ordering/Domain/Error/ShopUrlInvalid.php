<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\Refused;

/**
 * A connection's site URL the app may not call: not https (http only in dev), or a host that is or resolves to a
 * private, loopback or reserved address (docs/pdr/prd-shops-settings.md, Security, SSRF). `reason` says which.
 */
final class ShopUrlInvalid extends Refused
{
    public function __construct(private readonly string $reason)
    {
        parent::__construct('shop_url_invalid', 'The shop\'s site URL cannot be used: '.$reason);
    }

    public function details(): array
    {
        return ['reason' => $this->reason];
    }
}
