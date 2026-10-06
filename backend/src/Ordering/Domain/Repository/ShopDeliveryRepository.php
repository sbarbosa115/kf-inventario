<?php

namespace App\Ordering\Domain\Repository;

use App\Ordering\Domain\Error\ShopDeliveryNotFound;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopDelivery;

interface ShopDeliveryRepository
{
    /**
     * @throws ShopDeliveryNotFound also when it belongs to another connection
     */
    public function get(ShopConnection $connection, int $id): ShopDelivery;

    public function add(ShopDelivery $delivery): void;

    /** The connection's deliveries still waiting in the inbox. */
    public function countFailed(ShopConnection $connection): int;

    /** Deletes the inbox rows received before $before (90 days: the pull purges them). */
    public function purgeReceivedBefore(\DateTimeImmutable $before): int;
}
