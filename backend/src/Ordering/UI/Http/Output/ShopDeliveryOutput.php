<?php

namespace App\Ordering\UI\Http\Output;

/** A row of the failed-deliveries inbox. */
final readonly class ShopDeliveryOutput
{
    public function __construct(
        public int $id,
        /** webhook, pull or legacy */
        public string $kind,
        public ?string $remoteOrderId,
        /** placed, failed or discarded */
        public string $status,
        /** bad_signature, unknown_product, no_warehouse, not_an_order, no_lines, duplicate, inactive */
        public ?string $reasonCode,
        public ?string $reason,
        /** ISO 8601 */
        public string $receivedAt,
        public int $attempts,
        public ?OrderRefOutput $order,
        public DeliverySummaryOutput $summary,
    ) {
    }
}
