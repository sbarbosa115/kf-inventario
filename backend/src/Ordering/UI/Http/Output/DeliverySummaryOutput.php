<?php

namespace App\Ordering\UI\Http\Output;

/** What a stored delivery's body says, for the inbox's rows: who ordered and what. */
final readonly class DeliverySummaryOutput
{
    /**
     * @param list<DeliveryLineOutput> $lines
     */
    public function __construct(
        public ?string $customer,
        public array $lines,
    ) {
    }
}
