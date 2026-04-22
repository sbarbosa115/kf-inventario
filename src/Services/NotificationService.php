<?php

namespace App\Services;

use App\Entity\Order;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Contracts\Translation\TranslatorInterface;
use Twig\Environment;
use Twig\Error\LoaderError;
use Twig\Error\RuntimeError;
use Twig\Error\SyntaxError;

class NotificationService
{
    private MailerInterface $mailer;

    private TranslatorInterface $translator;

    private ParameterBagInterface $parameterBag;

    private Environment $twig;

    private PdfHandlerService $pdfHandler;

    public function __construct(
        MailerInterface $mailer,
        TranslatorInterface $translator,
        ParameterBagInterface $parameterBag,
        Environment $twig,
        PdfHandlerService $pdfHandlerService
    ) {
        $this->mailer = $mailer;
        $this->translator = $translator;
        $this->parameterBag = $parameterBag;
        $this->twig = $twig;
        $this->pdfHandler = $pdfHandlerService;
    }

    /**
     * @throws SyntaxError
     * @throws RuntimeError
     * @throws LoaderError
     */
    private function renderView(Order $order): string
    {
        return $this->twig->render('order/pdf.html.twig', [
            'order' => $order,
        ]);
    }
    /**
     * @throws TransportExceptionInterface
     */
    public function sendOrderByEmail(Order $order): void
    {
        $mailerParams = $this->parameterBag->get('mailer');

        $attachment = fopen('php://memory','r+');
        fwrite($attachment, $this->pdfHandler->createPdf(
            $this->renderView($order)
        ));
        rewind($attachment);

        $message = (new Email())
            ->subject(sprintf($this->translator->trans('notifications.emails.order_created.subject'), $order->getCode()))
            ->text($this->translator->trans('notifications.emails.order_created.body'))
            ->attach($attachment, sprintf('order-%s.pdf', $order->getId()), 'application/pdf');

        if ($mailerParams['from_address'] && $mailerParams['from_name'] && $mailerParams['printer_address']) {
            $message->from(new Address($mailerParams['from_address'], $mailerParams['from_name']));
            $message->to(new Address($mailerParams['printer_address']));
        }

        $this->mailer->send($message);
    }
}
