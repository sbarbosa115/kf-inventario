<?php

namespace App\Ordering\Domain\Repository;

use App\Ordering\Domain\Model\OrderCommentMeta;
use App\Ordering\Domain\Model\ShopConnection;

interface CommentMetaRepository
{
    public function ofComment(int $commentId): ?OrderCommentMeta;

    /**
     * @param list<int> $commentIds
     *
     * @return array<int, OrderCommentMeta> by comment id; comments without metadata are left out
     */
    public function ofComments(array $commentIds): array;

    /**
     * @param list<int> $orderIds
     *
     * @return array<int, OrderCommentMeta> each order's pinned comment, by order id
     */
    public function pinnedOfOrders(array $orderIds): array;

    /** A shop note already imported (pulls are idempotent). */
    public function byRemoteNote(ShopConnection $connection, string $remoteNoteId): ?OrderCommentMeta;

    public function add(OrderCommentMeta $meta): void;
}
