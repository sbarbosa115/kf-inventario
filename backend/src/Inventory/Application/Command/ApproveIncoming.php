<?php

namespace App\Inventory\Application\Command;

/**
 * Everything that arrived at a warehouse from a move is counted as in stock.
 */
final readonly class ApproveIncoming
{
    public function __construct(public int $warehouseId)
    {
    }
}
