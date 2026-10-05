<?php

namespace App\Ordering\Infrastructure\WooCommerce;

use App\Ordering\Application\Port\RemoteOrderSource;
use App\Ordering\Domain\Error\OrderSyncFailed;
use App\Shared\Domain\Clock;
use Automattic\WooCommerce\Client;
use Automattic\WooCommerce\HttpClient\HttpClientException;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * The shop's WooCommerce REST API (wc/v3) through the `automattic/woocommerce` client, with the one set of keys the
 * app has always had (WOO_COMMERCE_URL / _API_KEY / _API_SECRET): one shop, the one whose address a warehouse's `urls`
 * hold. Without all three the app reads no shop and the sync places nothing.
 *
 * The orders read are those waiting to be fulfilled (`processing`: paid, not shipped) created in the last
 * DAYS days, oldest first, PER_PAGE a page and at most MAX_PAGES pages.
 */
final class RestRemoteOrderSource implements RemoteOrderSource
{
    public const STATUS = 'processing';
    public const DAYS = 30;
    public const PER_PAGE = 100;
    public const MAX_PAGES = 20;

    /** @var (\Closure(string, string, string): Client)|null */
    private readonly ?\Closure $clientFactory;

    /**
     * @param (\Closure(string, string, string): Client)|null $clientFactory builds the client (url, key, secret)
     */
    public function __construct(
        private readonly Clock $clock,
        private readonly LoggerInterface $logger,
        #[Autowire('%env(WOO_COMMERCE_URL)%')]
        private readonly string $url = '',
        #[Autowire('%env(WOO_COMMERCE_API_KEY)%')]
        private readonly string $apiKey = '',
        #[Autowire('%env(WOO_COMMERCE_API_SECRET)%')]
        private readonly string $apiSecret = '',
        ?\Closure $clientFactory = null,
    ) {
        $this->clientFactory = $clientFactory;
    }

    public function shops(): array
    {
        return '' === trim($this->url) || '' === trim($this->apiKey) || '' === trim($this->apiSecret) ? [] : [trim($this->url)];
    }

    public function ordersOf(string $shop): array
    {
        if (!\in_array($shop, $this->shops(), true)) {
            throw new \LogicException(\sprintf('The app holds no REST API keys for the shop %s.', $shop));
        }

        $client = $this->client($shop);
        $after = $this->clock->now()->modify(\sprintf('-%d days', self::DAYS))->format('Y-m-d\TH:i:s');
        $orders = [];
        for ($page = 1; $page <= self::MAX_PAGES; ++$page) {
            $batch = $this->page($client, $shop, ['status' => self::STATUS, 'after' => $after, 'orderby' => 'date', 'order' => 'asc', 'per_page' => self::PER_PAGE, 'page' => $page]);
            array_push($orders, ...$batch);
            if (\count($batch) < self::PER_PAGE) {
                return $orders;
            }
        }
        $this->logger->warning(\sprintf('WooCommerce shop [%s] has more than %d waiting orders: the rest come with the next sync.', $shop, self::PER_PAGE * self::MAX_PAGES));

        return $orders;
    }

    /**
     * @param array<string, scalar> $query
     *
     * @return list<array<mixed>>
     *
     * @throws OrderSyncFailed
     */
    private function page(Client $client, string $shop, array $query): array
    {
        try {
            $answer = $client->get('orders', $query);
        } catch (HttpClientException $e) {
            // The client's message names the shop's error (or cURL's), never the keys: logged for whoever fixes it.
            $this->logger->error(\sprintf('WooCommerce shop [%s] could not be read: %s', $shop, $e->getMessage()), ['exception' => $e]);

            throw new OrderSyncFailed($shop, $e);
        }

        // The client decodes JSON into objects; the mapper reads the webhook's arrays.
        $orders = json_decode((string) json_encode($answer), true);
        if (!\is_array($orders) || !array_is_list($orders)) {
            $this->logger->error(\sprintf('WooCommerce shop [%s] did not answer a list of orders.', $shop));

            throw new OrderSyncFailed($shop);
        }

        return array_values(array_filter($orders, \is_array(...)));
    }

    private function client(string $shop): Client
    {
        if (null !== $this->clientFactory) {
            return ($this->clientFactory)($shop, $this->apiKey, $this->apiSecret);
        }

        return new Client($shop, $this->apiKey, $this->apiSecret, ['version' => 'wc/v3', 'timeout' => 30]);
    }
}
