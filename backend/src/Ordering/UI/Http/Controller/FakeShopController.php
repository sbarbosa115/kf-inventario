<?php

namespace App\Ordering\UI\Http\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;

/**
 * A tiny WooCommerce shop for the dev and smoke stack only (docs/pdr/prd-shops-settings.md, Decisions 17): the
 * seeded "Fake shop" connection's site is http://nginx/_fake-shop, so Test connection, the pull and the write-back
 * run end to end without a real shop. Behind kernel.debug: a production kernel answers 404.
 *
 * It answers the REST calls the app makes (RestShopGateway) with the keys of src/DataFixtures/ShopFixtures.php
 * (HTTP Basic): GET orders (status, modified_after, page), PUT orders/{id} (status), GET/POST orders/{id}/notes,
 * GET system_status; and GET /wp-json/ (the site's name). Its state lives in var/fake-shop.json; the specs fill and
 * read it through /_fake-shop/_state (GET: orders, notes and every write the app made; PUT: replace orders/notes;
 * DELETE: empty it).
 */
final class FakeShopController extends AbstractController
{
    private const KEY = 'ck_fake_shop';
    private const SECRET = 'cs_fake_shop';

    public function __construct(
        #[Autowire('%kernel.debug%')]
        private readonly bool $debug,
        #[Autowire('%kernel.project_dir%/var/fake-shop.json')]
        private readonly string $stateFile,
    ) {
    }

    #[Route('/_fake-shop/wp-json/', name: 'fake_shop_index', methods: ['GET'])]
    public function index(Request $request): JsonResponse
    {
        $this->devOnly();

        return new JsonResponse(['name' => 'Fake shop', 'description' => 'The dev stack\'s WooCommerce', 'url' => $request->getSchemeAndHttpHost().'/_fake-shop']);
    }

    #[Route('/_fake-shop/wp-json/wc/v3/{endpoint}', name: 'fake_shop_api', requirements: ['endpoint' => '[a-z_]+(/[0-9]+(/[a-z_]+)?)?'], methods: ['GET', 'POST', 'PUT'])]
    public function api(Request $request, string $endpoint): JsonResponse
    {
        $this->devOnly();
        if (self::KEY !== $request->getUser() || self::SECRET !== $request->getPassword()) {
            return new JsonResponse(['code' => 'woocommerce_rest_authentication_error', 'message' => 'Consumer key is invalid.'], 401);
        }
        $state = $this->state();
        $parts = explode('/', $endpoint);
        $method = $request->getMethod();

        if ('system_status' === $endpoint && 'GET' === $method) {
            return new JsonResponse(['environment' => ['version' => '8.9.0', 'site_url' => $request->getSchemeAndHttpHost().'/_fake-shop']]);
        }
        if ('orders' === $parts[0] && 1 === \count($parts) && 'GET' === $method) {
            return new JsonResponse($this->orders($state, $request));
        }
        if ('orders' === $parts[0] && 2 === \count($parts) && 'PUT' === $method) {
            $status = (string) ($this->body($request)['status'] ?? '');
            $state['writes'][] = ['call' => 'status', 'order' => $parts[1], 'value' => $status, 'at' => gmdate('c')];
            foreach ($state['orders'] as $i => $order) {
                if ((string) ($order['id'] ?? '') === $parts[1]) {
                    $state['orders'][$i]['status'] = $status;
                }
            }
            $this->save($state);

            return new JsonResponse(['id' => (int) $parts[1], 'status' => $status]);
        }
        if ('orders' === $parts[0] && 3 === \count($parts) && 'notes' === $parts[2]) {
            if ('GET' === $method) {
                return new JsonResponse(array_values($state['notes'][$parts[1]] ?? []));
            }
            if ('POST' === $method) {
                $id = 9000 + \count($state['writes']) + 1;
                $note = (string) ($this->body($request)['note'] ?? '');
                $state['writes'][] = ['call' => 'note', 'order' => $parts[1], 'value' => $note, 'at' => gmdate('c')];
                $this->save($state);

                return new JsonResponse(['id' => $id, 'note' => $note, 'customer_note' => false, 'date_created_gmt' => gmdate('Y-m-d\TH:i:s')], 201);
            }
        }

        return new JsonResponse(['code' => 'rest_no_route', 'message' => 'No route was found matching the URL and request method.'], 404);
    }

    #[Route('/_fake-shop/_state', name: 'fake_shop_state', methods: ['GET', 'PUT', 'DELETE'])]
    public function control(Request $request): JsonResponse
    {
        $this->devOnly();
        if ($request->isMethod('DELETE')) {
            $this->save(self::empty());
        } elseif ($request->isMethod('PUT')) {
            $given = $this->body($request);
            $state = $this->state();
            $state['orders'] = array_values(array_filter(\is_array($given['orders'] ?? null) ? $given['orders'] : [], \is_array(...)));
            $state['notes'] = \is_array($given['notes'] ?? null) ? $given['notes'] : [];
            $this->save($state);
        }

        return new JsonResponse($this->state());
    }

    /**
     * @param array{orders: list<array<string, mixed>>, notes: array<string, mixed>, writes: list<array<string, string>>} $state
     *
     * @return list<array<string, mixed>>
     */
    private function orders(array $state, Request $request): array
    {
        $status = $request->query->get('status');
        $since = $request->query->get('modified_after');
        $page = max(1, $request->query->getInt('page', 1));
        $perPage = max(1, $request->query->getInt('per_page', 10));
        $orders = array_values(array_filter($state['orders'], static fn (array $o): bool => (null === $status || ($o['status'] ?? 'processing') === $status)
            && (null === $since || !isset($o['date_modified_gmt']) || (string) $o['date_modified_gmt'] > (string) $since)));

        return \array_slice($orders, ($page - 1) * $perPage, $perPage);
    }

    /**
     * @return array<string, mixed>
     */
    private function body(Request $request): array
    {
        $body = json_decode($request->getContent(), true);

        return \is_array($body) ? $body : [];
    }

    /**
     * @return array{orders: list<array<string, mixed>>, notes: array<string, mixed>, writes: list<array<string, string>>}
     */
    private function state(): array
    {
        $saved = is_file($this->stateFile) ? json_decode((string) file_get_contents($this->stateFile), true) : null;

        return \is_array($saved) ? $saved + self::empty() : self::empty();
    }

    /**
     * @param array<string, mixed> $state
     */
    private function save(array $state): void
    {
        file_put_contents($this->stateFile, json_encode($state, \JSON_PRETTY_PRINT), \LOCK_EX);
    }

    /**
     * @return array{orders: list<array<string, mixed>>, notes: array<string, mixed>, writes: list<array<string, string>>}
     */
    private static function empty(): array
    {
        return ['orders' => [], 'notes' => [], 'writes' => []];
    }

    private function devOnly(): void
    {
        if (!$this->debug) {
            throw new NotFoundHttpException();
        }
    }
}
