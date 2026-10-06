<?php

namespace App\Ordering\Application\Query;

use App\Ordering\Application\Port\ShopCredentials;
use App\Ordering\Application\Port\ShopGateway;
use App\Ordering\Application\Port\ShopUrlGuard;
use App\Ordering\Domain\Error\ShopKeysRequired;
use App\Ordering\Domain\Error\ShopUnreachable;
use App\Ordering\Domain\Model\ShopConnection;

/**
 * "Test connection" (POST /shops/{id}/test): the shop's REST API is asked with the URL and keys typed in the form
 * (testing before saving), each blank one replaced by the saved one — only on the saved site: for another scheme,
 * host or port both keys must be typed, so the saved ones never go to a host nobody typed them for. It writes nothing and never throws: the outcome
 * says what happened. Whether the keys may write cannot be proved by a read (Security, "Write-back keys"): unknown,
 * or false once a write was refused with 401 (the connection's last failure `keys_read_only`).
 */
final class ShopsTester
{
    public const KEYS_READ_ONLY = 'keys_read_only';

    public function __construct(
        private readonly Shops $shops,
        private readonly ShopGateway $gateway,
        private readonly ShopUrlGuard $guard,
    ) {
    }

    public function test(ShopConnection $connection, ?string $siteUrl, ?string $consumerKey, ?string $consumerSecret): ShopsTestOutcome
    {
        $saved = $this->shops->credentials($connection);
        $url = self::given($siteUrl) ? ShopConnection::normaliseSiteUrl((string) $siteUrl) : $saved->siteUrl;
        $refusal = $this->guard->refusal($url);
        if (null !== $refusal) {
            return new ShopsTestOutcome(false, error: $refusal);
        }

        if (!ShopConnection::sameSite($saved->siteUrl, $url) && !(self::given($consumerKey) && self::given($consumerSecret))) {
            return new ShopsTestOutcome(false, error: ShopKeysRequired::MESSAGE);
        }

        $keys = new ShopCredentials(
            $url,
            self::given($consumerKey) ? trim((string) $consumerKey) : $saved->consumerKey,
            self::given($consumerSecret) ? trim((string) $consumerSecret) : $saved->consumerSecret,
        );

        try {
            $info = $this->gateway->storeInfo($keys);
        } catch (ShopUnreachable $e) {
            return new ShopsTestOutcome(false, error: $e->reason());
        }

        return new ShopsTestOutcome(true, $info->storeName, $info->wcVersion, self::KEYS_READ_ONLY === $connection->lastFailureCode() ? false : null);
    }

    private static function given(?string $value): bool
    {
        return null !== $value && '' !== trim($value);
    }
}
