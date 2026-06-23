<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Routing\Attribute\Route;

class DefaultController extends AbstractController
{
    #[Route('/', name: 'homepage')]
    public function index(): Response
    {
        return $this->redirectToRoute('product_product_index');
    }

    #[Route('/test-email', name: 'test_email')]
    public function testEmail(MailerInterface $mailer): Response
    {
        $email = (new Email())
            ->from('no-reply@klassicfab.com')
            ->to('sbarbosa@gmail.com')
            ->subject('Test email')
            ->text('This is a plain test email sent from the application.');

        try {
            $mailer->send($email);
        } catch (TransportExceptionInterface $e) {
            return new Response('Failed to send email: '.$e->getMessage(), Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        return new Response('Email sent to sbarbosa@gmail.com');
    }
}
