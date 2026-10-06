<?php

namespace App\Settings\Application\Port;

/**
 * Seals the secrets the app keeps in its database (the SMTP password inside the DSN, the shops' REST keys and webhook
 * secrets) with the key from env, APP_ENCRYPTION_KEY (docs/pdr/prd-shops-settings.md, Security). A sealed value is
 * "v1:" + base64(nonce‖box): never the plain text, never the same twice.
 */
interface SecretBox
{
    public function seal(string $plain): string;

    /**
     * @throws UnreadableSecret not sealed by this scheme, tampered with, or sealed with another key
     */
    public function open(string $sealed): string;
}
