<?php

namespace App\Shared\Application\Port;

/**
 * The activity log (table log): what was done to which kind of record, by whom (the signed-in user, or nobody for the
 * WooCommerce webhook), with its details as JSON. Written in the caller's transaction.
 */
interface ActivityLog
{
    /**
     * @param string               $entity the kind of record (lower-cased when written: "order", "customer", "mail"…)
     * @param array<string, mixed> $detail
     */
    public function record(string $entity, string $event, array $detail = []): void;
}
