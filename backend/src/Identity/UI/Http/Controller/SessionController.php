<?php

namespace App\Identity\UI\Http\Controller;

use App\Identity\UI\Http\Output\SessionOutput;
use App\Identity\UI\Http\Security\SignedInSession;
use App\Shared\UI\Http\ApiResponse;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

/**
 * Signing in and out of the app, and who is signed in. The firewall answers the first two (security.yaml: json_login
 * and logout); these routes give them a name and a place in the API schema.
 */
final class SessionController extends AbstractController
{
    /**
     * {"username", "password", "remember_me"?}: the session starts and the answer is who signed in. 401
     * invalid_credentials for a wrong username or password.
     */
    #[Route('/api/v1/auth/login', name: 'api_auth_login', methods: ['POST'])]
    #[ApiResponse(SessionOutput::class)]
    public function login(): never
    {
        throw new \LogicException('The firewall answers POST /api/v1/auth/login (json_login).');
    }

    /**
     * Ends the session: 204.
     */
    #[Route('/api/v1/auth/logout', name: 'api_auth_logout', methods: ['POST'])]
    public function logout(): never
    {
        throw new \LogicException('The firewall answers POST /api/v1/auth/logout.');
    }

    /**
     * Who is signed in. 401 when nobody is.
     */
    #[Route('/api/v1/auth/me', name: 'api_auth_me', methods: ['GET'])]
    #[ApiResponse(SessionOutput::class)]
    public function me(TokenStorageInterface $tokens, SignedInSession $session): JsonResponse
    {
        $token = $tokens->getToken() ?? throw new \LogicException('access_control requires a signed-in user here.');

        return $this->json($session->of($token));
    }
}
