<?php

namespace App\Identity\UI\Http\Security;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Http\Event\LogoutEvent;

/**
 * POST /api/v1/auth/logout ends the session (the firewall invalidates it) and answers 204, not a redirect.
 */
#[AsEventListener]
final class SignOutListener
{
    public function __invoke(LogoutEvent $event): void
    {
        $event->setResponse(new Response(null, Response::HTTP_NO_CONTENT));
    }
}
