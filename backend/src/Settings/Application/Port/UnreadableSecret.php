<?php

namespace App\Settings\Application\Port;

/**
 * A stored secret that cannot be opened: not sealed by SecretBox, changed in the database, or sealed with another
 * APP_ENCRYPTION_KEY (rotate with app:settings:rekey --old-key=…). The message never carries the secret.
 */
final class UnreadableSecret extends \RuntimeException
{
}
