<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\ExternalServiceFailed;

/**
 * A WooCommerce shop could not be read while pulling its orders: nothing of that sync is kept, and trying again later
 * may work.
 */
final class OrderSyncFailed extends ExternalServiceFailed
{
    public function __construct(string $shop, ?\Throwable $previous = null)
    {
        parent::__construct('order_sync_failed', \sprintf('The WooCommerce shop %s could not be read. Try again later.', $shop), $previous);
    }
}
