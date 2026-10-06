<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\ExternalServiceFailed;

/**
 * "Check now" could read none of the shops (each connection's failure is in its health); trying again later may work.
 */
final class OrderSyncFailed extends ExternalServiceFailed
{
    /**
     * @param string $shops the connections' names
     */
    public function __construct(string $shops, ?\Throwable $previous = null)
    {
        parent::__construct('order_sync_failed', \sprintf('No shop could be read (%s). Try again later.', $shops), $previous);
    }
}
