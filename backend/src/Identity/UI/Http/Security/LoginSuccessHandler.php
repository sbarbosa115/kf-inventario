<?php

namespace App\Identity\UI\Http\Security;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Http\Authentication\AuthenticationSuccessHandlerInterface;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * POST /api/v1/auth/login with the right username and password: the session starts and the answer is who signed in.
 */
final class LoginSuccessHandler implements AuthenticationSuccessHandlerInterface
{
    public function __construct(
        private readonly SignedInSession $session,
        private readonly SerializerInterface $serializer,
    ) {
    }

    public function onAuthenticationSuccess(Request $request, TokenInterface $token): JsonResponse
    {
        return JsonResponse::fromJsonString($this->serializer->serialize($this->session->of($token), 'json'));
    }
}
