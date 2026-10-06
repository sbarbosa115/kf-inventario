<?php

namespace App\Ordering\Application\Command;

use App\Ordering\Domain\Model\ShopConnection;

/**
 * What CreateShopConnection answers: the connection (its id is assigned when the bus commits, so it is read once
 * dispatch() has returned) and its signing secret in the clear — shown once, in the answer that created it.
 */
final class CreatedShopConnection
{
    public function __construct(
        private readonly ShopConnection $connection,
        #[\SensitiveParameter] public readonly string $webhookSecret,
    ) {
    }

    public function id(): int
    {
        return (int) $this->connection->id();
    }
}
