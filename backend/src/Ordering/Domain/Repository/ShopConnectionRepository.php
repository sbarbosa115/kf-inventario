<?php

namespace App\Ordering\Domain\Repository;

use App\Ordering\Domain\Error\ShopConnectionNotFound;
use App\Ordering\Domain\Model\ShopConnection;

interface ShopConnectionRepository
{
    /**
     * @throws ShopConnectionNotFound
     */
    public function get(int $id): ShopConnection;

    /** The connection a webhook path names; null for an unknown token. */
    public function byWebhookToken(string $token): ?ShopConnection;

    public function byName(string $name): ?ShopConnection;

    /** By the normalised site URL (ShopConnection::normaliseSiteUrl). */
    public function bySiteUrl(string $siteUrl): ?ShopConnection;

    /**
     * @return list<ShopConnection> by name
     */
    public function all(): array;

    /**
     * @return list<ShopConnection> the active ones, by name
     */
    public function active(): array;

    public function add(ShopConnection $connection): void;

    public function remove(ShopConnection $connection): void;
}
