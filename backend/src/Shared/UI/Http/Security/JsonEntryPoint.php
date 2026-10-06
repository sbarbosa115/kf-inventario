<?php

namespace App\Shared\UI\Http\Security;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Http\EntryPoint\AuthenticationEntryPointInterface;

/**
 * Nobody signed in: the API answers 401 in the API's error shape, and the UI shows the sign-in page. A legacy Twig page
 * (until item 12 removes them) is sent to the React sign-in page instead.
 */
final class JsonEntryPoint implements AuthenticationEntryPointInterface
{
    public function start(Request $request, ?AuthenticationException $authException = null): Response
    {
        if (!str_starts_with($request->getPathInfo(), '/api/')) {
            return new RedirectResponse('/admin/login');
        }

        return new JsonResponse(['error' => 'unauthorized', 'message' => 'Sign in first.'], 401);
    }
}
