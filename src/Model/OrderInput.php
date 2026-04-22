<?php

namespace App\Model;

use App\Entity\Order;
use Symfony\Component\Validator\Constraints as Assert;

class OrderInput
{
    /**
     * @Assert\Optional()
     *
     * @var int
     */
    public $id;

    public const STATUSES = [
        Order::STATUS_CREATED,
        Order::STATUS_PROCESSED,
        Order::STATUS_COMPLETED,
        Order::STATUS_PARTIAL,
        Order::STATUS_SENT,
        Order::STATUS_DELIVERED,
    ];

    /**
     * @Assert\NotBlank()
     * @Assert\Choice(choices=OrderInput::STATUSES, message="Status not valid")
     *
     * @var int
     */
    public $status;

    public const SOURCES = [
        Order::SOURCE_PHONE,
        Order::SOURCE_WEB,
    ];

    /**
     * @Assert\NotBlank()
     * @Assert\Choice(choices=OrderInput::SOURCES, message="Source not valid")
     *
     * @var int
     */
    public $source;

    /**
     * @Assert\NotBlank()
     *
     * @var string
     */
    public $createdAtAsString;

    public const PAYMENT_METHOD = [
        Order::PAYMENT_CREDIT_CARD,
        Order::PAYMENT_PAYPAL,
    ];

    /**
     * @Assert\NotBlank()
     * @Assert\Choice(choices=OrderInput::PAYMENT_METHOD, message="Payment method not valid")
     *
     * @var int
     */
    public $paymentMethod;

    /**
     * @Assert\Optional()
     *
     * @var string
     */
    public $comment;

    /**
     * @Assert\NotBlank()
     *
     * @var string
     */
    public $warehouse;

    public static function createFormInput(array $removeOrderData): self
    {
        $new = new self();
        $new->order = $removeOrderData['order'];
        $new->token = $removeOrderData['token'];

        return $new;
    }
}
