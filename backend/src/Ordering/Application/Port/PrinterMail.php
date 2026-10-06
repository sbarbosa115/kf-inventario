<?php

namespace App\Ordering\Application\Port;

use App\Ordering\Domain\Model\Order;

/**
 * The email of a new order to the printer (MAILER_PRINTER_ADDRESS, the cc list, the order PDF attached).
 */
interface PrinterMail
{
    /**
     * @throws \RuntimeException when the mailer settings are missing or the email cannot be queued
     */
    public function orderCreated(Order $order): void;
}
