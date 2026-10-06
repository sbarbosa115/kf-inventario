<?php

namespace App\Settings\Infrastructure\Mail;

use App\Settings\Application\Port\TestEmailThrottle;
use Psr\Cache\CacheItemPoolInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/** The window in the app cache (the filesystem on cPanel): an item per user that expires after the window. */
final class CacheTestEmailThrottle implements TestEmailThrottle
{
    public function __construct(#[Autowire(service: 'cache.app')] private readonly CacheItemPoolInterface $cache)
    {
    }

    public function allow(string $who, int $seconds): bool
    {
        $item = $this->cache->getItem('settings.test_email.'.preg_replace('/[^A-Za-z0-9_.-]/', '_', $who));
        if ($item->isHit()) {
            return false;
        }
        $this->cache->save($item->set(true)->expiresAfter($seconds));

        return true;
    }
}
