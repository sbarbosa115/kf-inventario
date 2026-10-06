<?php

namespace App\Tests\Unit\Settings;

use App\Settings\Application\Port\UnreadableSecret;
use App\Settings\Infrastructure\Crypto\SodiumSecretBox;
use PHPUnit\Framework\TestCase;

/**
 * Secrets at rest (docs/pdr/prd-shops-settings.md, Security): XSalsa20-Poly1305 with APP_ENCRYPTION_KEY, stored as
 * "v1:" + base64(nonce‖box).
 */
final class SodiumSecretBoxTest extends TestCase
{
    private const KEY = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

    public function testASealedSecretOpensBackToTheSameText(): void
    {
        $box = new SodiumSecretBox(self::KEY);

        $sealed = $box->seal('smtp://orders:p4ss@mail.example.com:465');

        self::assertSame('smtp://orders:p4ss@mail.example.com:465', $box->open($sealed));
    }

    public function testTheStoredFormIsVersionedAndNeverHoldsThePlainText(): void
    {
        $sealed = (new SodiumSecretBox(self::KEY))->seal('p4ss');

        self::assertStringStartsWith('v1:', $sealed, 'The format is versioned, so a later scheme can be told apart.');
        self::assertStringNotContainsString('p4ss', $sealed);
        $raw = base64_decode(substr($sealed, 3), true);
        self::assertIsString($raw);
        self::assertSame(\SODIUM_CRYPTO_SECRETBOX_NONCEBYTES + \SODIUM_CRYPTO_SECRETBOX_MACBYTES + 4, \strlen($raw), 'nonce ‖ MAC ‖ ciphertext');
    }

    public function testTheSameSecretSealsDifferentlyEachTime(): void
    {
        $box = new SodiumSecretBox(self::KEY);

        self::assertNotSame($box->seal('same'), $box->seal('same'), 'A random nonce per seal.');
    }

    public function testATamperedSecretIsRefused(): void
    {
        $box = new SodiumSecretBox(self::KEY);
        $raw = (string) base64_decode(substr($box->seal('p4ss'), 3), true);
        $raw[\strlen($raw) - 1] = \chr(\ord($raw[\strlen($raw) - 1]) ^ 1);

        $this->expectException(UnreadableSecret::class);
        $box->open('v1:'.base64_encode($raw));
    }

    public function testAnotherKeyCannotOpenIt(): void
    {
        $sealed = (new SodiumSecretBox(self::KEY))->seal('p4ss');

        $this->expectException(UnreadableSecret::class);
        (new SodiumSecretBox(str_repeat('ab', 32)))->open($sealed);
    }

    public function testSomethingThatIsNotASealedSecretIsRefused(): void
    {
        $this->expectException(UnreadableSecret::class);
        (new SodiumSecretBox(self::KEY))->open('p4ss');
    }

    public function testAMissingOrShortKeyRefusesToStart(): void
    {
        foreach (['', 'abc', str_repeat('zz', 32), str_repeat('ab', 16)] as $key) {
            try {
                new SodiumSecretBox($key);
                self::fail(\sprintf('The key "%s" must be refused.', $key));
            } catch (\InvalidArgumentException $e) {
                self::assertStringContainsString('APP_ENCRYPTION_KEY', $e->getMessage(), 'The message names the setting to fix.');
            }
        }
    }
}
