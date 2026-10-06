<?php

namespace App\Ordering\UI\Http\Output;

/** An inbox row with the body the shop sent (customer data: admins only, this endpoint only). */
final readonly class ShopDeliveryDetailOutput
{
    public function __construct(
        public int $id,
        /** webhook, pull or legacy */
        public string $kind,
        public ?string $remoteOrderId,
        /** placed, failed or discarded */
        public string $status,
        public ?string $reasonCode,
        public ?string $reason,
        /** ISO 8601 */
        public string $receivedAt,
        public int $attempts,
        public ?OrderRefOutput $order,
        public DeliverySummaryOutput $summary,
        /** The raw JSON body; null for a refused signature */
        public ?string $payload,
    ) {
    }
}
