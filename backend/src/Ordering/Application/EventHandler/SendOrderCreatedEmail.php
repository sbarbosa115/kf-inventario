<?php

namespace App\Ordering\Application\EventHandler;

use App\Ordering\Application\Port\PrinterMail;
use App\Ordering\Domain\Event\OrderPlaced;
use App\Ordering\Domain\Repository\OrderRepository;
use App\Shared\Application\Event\EventHandler;
use App\Shared\Application\Port\ActivityLog;
use Psr\Log\LoggerInterface;

/**
 * After the order is saved: the printer's email goes on the queue. When it cannot (the mailer settings are missing),
 * the order stays placed and the failure is a `mail` log row, as the legacy controller wrote it.
 */
final class SendOrderCreatedEmail implements EventHandler
{
    public function __construct(
        private readonly OrderRepository $orders,
        private readonly PrinterMail $mail,
        private readonly ActivityLog $activity,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function __invoke(OrderPlaced $event): void
    {
        if (!$event->notifyPrinter) {
            return;
        }

        try {
            $this->mail->orderCreated($this->orders->get($event->orderId));
        } catch (\RuntimeException $e) {
            $message = \sprintf('Failed to send order email for order %s: %s', $event->orderId, $e->getMessage());
            $this->activity->record('Mail', $message);
            $this->logger->error($message, ['exception' => $e]);
        }
    }
}
