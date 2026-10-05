<?php

namespace App\Shared\UI\Http\Security;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * The headers every response carries: the browser does not guess a content type (an upload or a JSON body is never
 * run as a script), no other site may frame the app (clickjacking), and the app's URLs are not sent to other sites.
 * A full Content-Security-Policy (scripts and styles) is not set: the screens load Bootstrap, jQuery and Font Awesome
 * from CDNs (docs/security/audits/2026-10-05-restructure.md).
 */
#[AsEventListener(event: KernelEvents::RESPONSE)]
final class SecurityHeaders
{
    private const HEADERS = [
        'X-Content-Type-Options' => 'nosniff',
        'X-Frame-Options' => 'DENY',
        'Content-Security-Policy' => "frame-ancestors 'none'",
        'Referrer-Policy' => 'same-origin',
    ];

    public function __invoke(ResponseEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $headers = $event->getResponse()->headers;
        foreach (self::HEADERS as $name => $value) {
            if (!$headers->has($name)) {
                $headers->set($name, $value);
            }
        }
    }
}
