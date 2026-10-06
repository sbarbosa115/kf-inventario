<?php

namespace App\Ordering\Application\Port;

use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopDelivery;

/**
 * A connection's failed-deliveries inbox as a whole: the rows the inbox screen lists (bounded: the pull purges rows
 * older than 90 days) and their removal with the connection.
 */
interface ShopInbox
{
    /**
     * @return list<ShopDelivery> newest first
     */
    public function ofConnection(ShopConnection $connection): array;

    /** Deletes every inbox row of the connection (it is being deleted; no order came from it). */
    public function removeOfConnection(ShopConnection $connection): void;
}
