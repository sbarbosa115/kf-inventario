<?php

namespace App\Ordering\Domain\Repository;

use App\Ordering\Domain\Error\OrderNotFound;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderProduct;

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
     * Writes the new order now, inside the command's transaction, so it has its id (the table's auto-increment key)
     * for the answer, the activity log and the OrderPlaced event. Rolled back with the command if it fails.
     */
    public function identify(Order $order): int;

    /**
     * A new comment on an order (the association does not cascade).
     */
    public function addComment(Comment $comment): void;

    /**
     * Soft-deletes the order (Gedmo: deleted_at); its products and comments are removed first by the caller, as the
     * legacy delete did.
     */
    public function remove(Order $order): void;

    /**
     * A product line taken out of an order (edit, delete): the row is deleted.
     */
    public function removeLine(OrderProduct $line): void;

    /**
     * A comment deleted with its order (Gedmo soft delete, as the legacy delete did).
     */
    public function removeComment(Comment $comment): void;

    /**
     * A warehouse's orders (partial shipments, which have no warehouse, are not among them), newest first, with their
     * customer (when they have one) and comments.
     *
     * @return list<Order>
     */
    public function ofWarehouse(int $warehouseId): array;
}
