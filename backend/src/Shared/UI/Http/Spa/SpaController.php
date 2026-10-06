<?php

namespace App\Shared\UI\Http\Spa;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * The React app's HTML shell for every page URL (/admin/login, /admin/products…): the router in the browser decides
 * what to show. API paths, the WooCommerce webhook and real files never reach it — they are excluded here, and
 * Apache/nginx serve files first. The legacy Twig routes win over it while they exist (it is the last route).
 */
final class SpaController extends AbstractController
{
    #[Route('/{path}', name: 'spa', requirements: ['path' => '(?!api/|api$|_|admin/order/1H39j0jpQPsWL958v9R4$|webhooks/).*'], methods: ['GET'], priority: -100)]
    public function __invoke(): Response
    {
        return $this->render('spa.html.twig');
    }
}
