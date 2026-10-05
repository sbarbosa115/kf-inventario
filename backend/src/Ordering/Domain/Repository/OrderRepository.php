<?php

namespace App\Ordering\Domain\Repository;

use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Model\Order;

interface OrderRepository
{
    /**
     * A deleted order (soft delete) is not found.
     *
     * @throws OrderNotFound
     */
    public function get(int $id): Order;

    public function add(Order $order): void;

    /**
     * Soft-deletes the order (Gedmo: deleted_at); its products and comments are removed first by the caller, as the
     * legacy delete did.
     */
    public function remove(Order $order): void;
}
