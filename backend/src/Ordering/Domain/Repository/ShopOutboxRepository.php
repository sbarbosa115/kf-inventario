<?php

namespace App\Ordering\Domain\Repository;

use App\Ordering\Domain\Error\ShopOutboxNotFound;
use App\Ordering\Domain\Model\ShopConnection;
use App\Ordering\Domain\Model\ShopOutbox;

interface ShopOutboxRepository
{
    /**
     * @throws ShopOutboxNotFound
     */
    public function get(int $id): ShopOutbox;

    public function add(ShopOutbox $entry): void;

    /** The connection's writes that failed every retry. */
    public function countFailed(ShopConnection $connection): int;

    /**
     * @return list<ShopOutbox> the connection's rows in that status, newest first
     */
    public function ofConnection(ShopConnection $connection, string $status): array;
}
