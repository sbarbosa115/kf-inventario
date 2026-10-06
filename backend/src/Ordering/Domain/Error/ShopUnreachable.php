<?php

namespace App\Ordering\Domain\Error;

use App\Shared\Domain\Error\ExternalServiceFailed;

/**
 * A shop's REST API could not be used: down, a timeout, refused keys (401: the keys are read-only or wrong), not
 * WooCommerce, or a URL the SSRF guard refuses. `reason` is the shop's own message, without keys.
 */
final class ShopUnreachable extends ExternalServiceFailed
{
    public function __construct(
        private readonly string $reason,
        private readonly ?int $httpStatus = null,
        ?\Throwable $previous = null,
    ) {
        parent::__construct('shop_unreachable', 'The shop could not be reached: '.$reason, $previous);
    }

    public function reason(): string
    {
        return $this->reason;
    }

    /** The shop's HTTP status, when it answered (401: the keys cannot write). */
    public function httpStatus(): ?int
    {
        return $this->httpStatus;
    }

    public function details(): array
    {
        return ['reason' => $this->reason];
    }
}
