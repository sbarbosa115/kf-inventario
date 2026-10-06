<?php

namespace App\Shared\Application\Query;

/** From this Bogota day to that one, both included; either end may be open. Each end is midnight in Bogota. */
final readonly class DateRangeFilter implements ListFilter
{
    public function __construct(
        public ?\DateTimeImmutable $from,
        public ?\DateTimeImmutable $to,
    ) {
    }

    /** The first moment after the range: midnight after `to`. */
    public function endExclusive(): ?\DateTimeImmutable
    {
        return $this->to?->modify('+1 day');
    }
}
