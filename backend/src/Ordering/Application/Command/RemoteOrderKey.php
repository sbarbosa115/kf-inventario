<?php

namespace App\Ordering\Application\Command;

/**
 * What says a WooCommerce order is already in the app: the shop's order id is the order's code (the webhook and the
 * pull store it so), in the warehouse that receives that shop's orders. Two shops number their orders on their own,
 * so the warehouse is part of the key.
 */
final readonly class RemoteOrderKey implements \Stringable
{
    private function __construct(
        public int $warehouseId,
        public string $code,
    ) {
    }

    /**
     * The key of an order pulled from a shop; null when it has no id (not a WooCommerce order).
     *
     * @param array<mixed> $remoteOrder the REST API's JSON
     */
    public static function ofRemoteOrder(int $warehouseId, array $remoteOrder): ?self
    {
        $id = $remoteOrder['id'] ?? null;

        return \is_scalar($id) ? self::ofOrder($warehouseId, (string) $id) : null;
    }

    /**
     * The key of an order of the app; null when it has no code (typed without one: it came from no shop).
     */
    public static function ofOrder(int $warehouseId, ?string $code): ?self
    {
        $code = trim((string) $code);

        return '' === $code ? null : new self($warehouseId, $code);
    }

    public function equals(self $other): bool
    {
        return $this->warehouseId === $other->warehouseId && $this->code === $other->code;
    }

    public function __toString(): string
    {
        return $this->warehouseId.':'.$this->code;
    }
}
