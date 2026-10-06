<?php

namespace App\Ordering\Infrastructure\Persistence;

use App\Ordering\Application\Port\ShopOrderLinks;
use App\Ordering\Application\Port\ShopRef;
use App\Ordering\Domain\Model\ShopCapability;
use App\Ordering\Domain\Repository\ShopOrderLinkRepository;

final class DoctrineShopOrderLinks implements ShopOrderLinks
{
    public function __construct(private readonly ShopOrderLinkRepository $links)
    {
    }

    public function shopsOf(array $orderIds): array
    {
        return array_map(
            static fn ($link) => new ShopRef((int) $link->connection()->id(), $link->connection()->name(), $link->connection()->isActive() && $link->connection()->can(ShopCapability::OrderNote)),
            $this->links->ofOrders($orderIds),
        );
    }
}
