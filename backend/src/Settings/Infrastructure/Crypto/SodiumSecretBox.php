<?php

namespace App\Settings\Infrastructure\Crypto;

use App\Settings\Application\Port\SecretBox;
use App\Settings\Application\Port\UnreadableSecret;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * SecretBox on libsodium's secretbox (XSalsa20-Poly1305): a random 24-byte nonce per seal, the MAC checked on open.
 * Rejected alternatives in docs/pdr/prd-shops-settings.md, Decisions 2.
 */
final class SodiumSecretBox implements SecretBox
{
    private const PREFIX = 'v1:';

    private readonly string $key;

    /**
     * @param string $hexKey APP_ENCRYPTION_KEY: 64 hex characters (32 bytes)
     */
    public function __construct(#[Autowire('%env(APP_ENCRYPTION_KEY)%')] string $hexKey)
    {
        $key = 1 === preg_match('/^[0-9a-fA-F]{64}$/', $hexKey) ? hex2bin($hexKey) : false;
        if (false === $key || \SODIUM_CRYPTO_SECRETBOX_KEYBYTES !== \strlen($key)) {
            throw new \InvalidArgumentException('APP_ENCRYPTION_KEY must be 64 hex characters (32 bytes): generate one with php -r \'echo bin2hex(random_bytes(32));\' and set it in backend/.env.local.');
        }
        $this->key = $key;
    }

    public function seal(string $plain): string
    {
        $nonce = random_bytes(\SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);

        return self::PREFIX.base64_encode($nonce.sodium_crypto_secretbox($plain, $nonce, $this->key));
    }

    public function open(string $sealed): string
    {
        if (!str_starts_with($sealed, self::PREFIX)) {
            throw new UnreadableSecret('Not a sealed secret.');
        }
        $raw = base64_decode(substr($sealed, \strlen(self::PREFIX)), true);
        if (false === $raw || \strlen($raw) < \SODIUM_CRYPTO_SECRETBOX_NONCEBYTES + \SODIUM_CRYPTO_SECRETBOX_MACBYTES) {
            throw new UnreadableSecret('The sealed secret is malformed.');
        }
        $plain = sodium_crypto_secretbox_open(
            substr($raw, \SODIUM_CRYPTO_SECRETBOX_NONCEBYTES),
            substr($raw, 0, \SODIUM_CRYPTO_SECRETBOX_NONCEBYTES),
            $this->key,
        );
        if (false === $plain) {
            throw new UnreadableSecret('The sealed secret was changed or sealed with another APP_ENCRYPTION_KEY.');
        }

        return $plain;
    }
}
