<?php

namespace App\Ordering\Application\Command;

use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Application\Port\OrderInventory;
use App\Ordering\Application\Port\ShopUrlGuard;
use App\Ordering\Domain\Error\OrderWarehouseNotFound;
use App\Ordering\Domain\Error\ShopNameTaken;
use App\Ordering\Domain\Error\ShopUrlInvalid;
use App\Ordering\Domain\Error\ShopUrlTaken;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Repository\ShopConnectionRepository;

/**
 * The rules a saved connection keeps, for creating and editing alike: a URL the app may call (Decisions 4: https,
 * http only in dev, no private host), one connection per site and per name, a warehouse that exists.
 */
final class ShopConnectionChecks
{
    public function __construct(
        private readonly ShopConnectionRepository $connections,
        private readonly ShopUrlGuard $guard,
        private readonly OrderInventory $inventory,
    ) {
    }

    /**
     * @return Warehouse the connection's orders' warehouse
     *
     * @throws ShopUrlInvalid|ShopUrlTaken|ShopNameTaken|OrderWarehouseNotFound
     */
    public function check(ShopConnectionDetails $details, ?ShopConnection $editing = null): Warehouse
    {
        $url = ShopConnection::normaliseSiteUrl($details->siteUrl);
        $refusal = $this->guard->refusal($url);
        if (null !== $refusal) {
            throw new ShopUrlInvalid($refusal);
        }
        $sameUrl = $this->connections->bySiteUrl($url);
        if (null !== $sameUrl && $sameUrl !== $editing) {
            throw new ShopUrlTaken();
        }
        $sameName = $this->connections->byName(trim($details->name));
        if (null !== $sameName && $sameName !== $editing) {
            throw new ShopNameTaken();
        }

        return $this->inventory->warehouse($details->warehouseId);
    }
}
