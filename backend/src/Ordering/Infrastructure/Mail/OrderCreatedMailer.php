<?php

namespace App\Ordering\Infrastructure\Mail;

use App\Ordering\Application\Port\OrderDocuments;
use App\Ordering\Application\Port\PrinterMail;
use App\Ordering\Domain\Model\Order;
use App\Shared\Infrastructure\Mail\QueuedMailer;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Component\Mime\Address;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * The legacy NotificationService::sendOrderByEmail, on the `mail` queue: from MAILER_FROM_ADDRESS/NAME to
 * MAILER_PRINTER_ADDRESS, the ordering.order_email.cc list in cc, subject "Order #<code> was created", the text body,
 * the order PDF attached as order-<id>.pdf.
 */
final class OrderCreatedMailer implements PrinterMail
{
    /**
     * @param list<string> $cc
     */
    public function __construct(
        private readonly QueuedMailer $mailer,
        private readonly OrderDocuments $documents,
        private readonly TranslatorInterface $translator,
        private readonly string $fromAddress,
        private readonly string $fromName,
        private readonly string $printerAddress,
        private readonly array $cc,
    ) {
    }

    public function orderCreated(Order $order): void
    {
        // The legacy email went out without a sender or recipient when these were missing, and failed: now it is not
        // built at all, and the caller logs why.
        if ('' === $this->fromAddress || '' === $this->fromName || '' === $this->printerAddress) {
            throw new \RuntimeException('The order email is not configured (MAILER_FROM_ADDRESS, MAILER_FROM_NAME, MAILER_PRINTER_ADDRESS).');
        }

        $email = (new TemplatedEmail())
            ->from(new Address($this->fromAddress, $this->fromName))
            ->to(new Address($this->printerAddress))
            ->subject(\sprintf($this->translator->trans('notifications.emails.order_created.subject'), $order->getCode()))
            ->text($this->translator->trans('notifications.emails.order_created.body'))
            ->attach($this->documents->pdf($order), \sprintf('order-%s.pdf', $order->getId()), 'application/pdf');
        foreach ($this->cc as $address) {
            $email->addCc(new Address($address));
        }

        $this->mailer->send($email, 'order-created');
    }
}
