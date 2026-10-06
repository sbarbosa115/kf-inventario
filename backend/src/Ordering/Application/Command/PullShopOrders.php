<?php

namespace App\Ordering\Application\Command;

/**
 * The catch-up pull of one shop connection (docs/pdr/prd-shops-settings.md, Decisions 11): its orders modified since
 * its cursor. Run for each due connection by app:shops:pull, for every active one by "Check now".
 */
final readonly class PullShopOrders
{
    public function __construct(
        public int $connectionId,
    ) {
    }
}
