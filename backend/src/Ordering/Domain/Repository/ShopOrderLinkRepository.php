<?php

namespace App\Ordering\Domain\Repository;

use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopOrderLink;

interface ShopOrderLinkRepository
{
    public function ofOrder(int $orderId): ?ShopOrderLink;

    /**
     * @param list<int> $orderIds
     *
     * @return array<int, ShopOrderLink> by order id; orders without a link are left out
     */
    public function ofOrders(array $orderIds): array;

    public function byRemoteOrder(ShopConnection $connection, string $remoteOrderId): ?ShopOrderLink;

    public function hasLinks(ShopConnection $connection): bool;

    public function add(ShopOrderLink $link): void;
}
