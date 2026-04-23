<?php

namespace App\Model;

use App\Entity\Order;
use Symfony\Component\Validator\Constraints as Assert;

class OrderInput
{
    public mixed $id = null;

    public const STATUSES = [
        Order::STATUS_CREATED,
        Order::STATUS_PROCESSED,
        Order::STATUS_COMPLETED,
        Order::STATUS_PARTIAL,
        Order::STATUS_SENT,
        Order::STATUS_DELIVERED,
    ];

    #[Assert\NotBlank]
    #[Assert\Choice(choices: OrderInput::STATUSES, message: 'Status not valid')]
    public mixed $status = null;

    public const SOURCES = [
        Order::SOURCE_PHONE,
        Order::SOURCE_WEB,
    ];

    #[Assert\NotBlank]
    #[Assert\Choice(choices: OrderInput::SOURCES, message: 'Source not valid')]
    public mixed $source = null;

    #[Assert\NotBlank]
    public mixed $createdAtAsString = null;

    public const PAYMENT_METHOD = [
        Order::PAYMENT_CREDIT_CARD,
        Order::PAYMENT_PAYPAL,
    ];

    #[Assert\NotBlank]
    #[Assert\Choice(choices: OrderInput::PAYMENT_METHOD, message: 'Payment method not valid')]
    public mixed $paymentMethod = null;

    public mixed $comment = null;

    #[Assert\NotBlank]
    public mixed $warehouse = null;
}
