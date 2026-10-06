<?php

namespace App\Ordering\Domain\Model;

use App\Inventory\Domain\Model\Warehouse;
use Doctrine\ORM\Mapping as ORM;

/**
 * One WooCommerce shop: where its orders land (warehouse), whether they are printed, what the app may write back to
 * it (capabilities), its keys and webhook secret (sealed by Settings' SecretBox: this entity only holds the sealed
 * strings), and its health — written by the webhook, the pull and the pusher.
 *
 * The webhook of a connection is /webhooks/shops/{webhookToken}: the token identifies the connection, the secret
 * signs every delivery (docs/pdr/prd-shops-settings.md, Decisions 4 and 5).
 */
#[ORM\Entity]
#[ORM\Table(name: 'shop_connection', options: ['charset' => 'utf8mb4', 'collation' => 'utf8mb4_unicode_ci'])]
class ShopConnection
{
    public const WEBHOOK_PATH = '/webhooks/shops/';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 100, unique: true)]
    private string $name;

    #[ORM\Column(type: 'string', length: 255, unique: true)]
    private string $siteUrl;

    /** Sealed. */
    #[ORM\Column(type: 'text')]
    private string $consumerKey;

    /** Sealed. */
    #[ORM\Column(type: 'text')]
    private string $consumerSecret;

    #[ORM\Column(type: 'string', length: 64, unique: true)]
    private string $webhookToken;

    /** Sealed. */
    #[ORM\Column(type: 'text')]
    private string $webhookSecret;

    #[ORM\Column(type: 'boolean')]
    private bool $active;

    #[ORM\ManyToOne(targetEntity: Warehouse::class)]
    #[ORM\JoinColumn(name: 'warehouse_id', nullable: false)]
    private Warehouse $warehouse;

    #[ORM\Column(type: 'boolean')]
    private bool $emailPrinter;

    /** @var array<string, bool> */
    #[ORM\Column(type: 'json')]
    private array $capabilities;

    /** The newest date_modified_gmt of the last successful pull. */
    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $pullCursor = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $lastWebhookAt = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $lastImportAt = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $lastPullAt = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $lastPullOkAt = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $lastFailureAt = null;

    #[ORM\Column(type: 'string', length: 64, nullable: true)]
    private ?string $lastFailureCode = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $lastFailure = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;

    /**
     * @param array<string, bool> $capabilities by ShopCapability value; missing ones are off
     */
    public function __construct(
        string $name,
        string $siteUrl,
        string $sealedConsumerKey,
        string $sealedConsumerSecret,
        string $webhookToken,
        string $sealedWebhookSecret,
        Warehouse $warehouse,
        bool $emailPrinter,
        bool $active,
        array $capabilities,
        \DateTimeImmutable $at,
    ) {
        $this->name = $name;
        $this->siteUrl = self::normaliseSiteUrl($siteUrl);
        $this->consumerKey = $sealedConsumerKey;
        $this->consumerSecret = $sealedConsumerSecret;
        $this->webhookToken = $webhookToken;
        $this->webhookSecret = $sealedWebhookSecret;
        $this->warehouse = $warehouse;
        $this->emailPrinter = $emailPrinter;
        $this->active = $active;
        $this->capabilities = self::capabilityMap($capabilities);
        $this->createdAt = $at;
        $this->updatedAt = $at;
    }

    /**
     * `https://Shop.Example.com/store/` → `https://shop.example.com/store`: scheme and host lower-case, no trailing
     * slash, no query or fragment. The scheme is kept as given (http is refused outside dev by the use case).
     */
    public static function normaliseSiteUrl(string $url): string
    {
        $parts = parse_url(trim($url));
        if (false === $parts || !isset($parts['scheme'], $parts['host'])) {
            return rtrim(trim($url), '/');
        }
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';

        return strtolower($parts['scheme']).'://'.strtolower($parts['host']).$port.rtrim($parts['path'] ?? '', '/');
    }

    /**
     * @param array<string, bool> $capabilities
     */
    public function reconfigure(string $name, string $siteUrl, Warehouse $warehouse, bool $emailPrinter, bool $active, array $capabilities, \DateTimeImmutable $at): void
    {
        $this->name = $name;
        $this->siteUrl = self::normaliseSiteUrl($siteUrl);
        $this->warehouse = $warehouse;
        $this->emailPrinter = $emailPrinter;
        $this->active = $active;
        $this->capabilities = self::capabilityMap($capabilities);
        $this->updatedAt = $at;
    }

    public function replaceKeys(string $sealedConsumerKey, string $sealedConsumerSecret, \DateTimeImmutable $at): void
    {
        $this->consumerKey = $sealedConsumerKey;
        $this->consumerSecret = $sealedConsumerSecret;
        $this->updatedAt = $at;
    }

    public function rotateWebhookSecret(string $sealedWebhookSecret, \DateTimeImmutable $at): void
    {
        $this->webhookSecret = $sealedWebhookSecret;
        $this->updatedAt = $at;
    }

    public function activate(bool $active, \DateTimeImmutable $at): void
    {
        $this->active = $active;
        $this->updatedAt = $at;
    }

    /** The connection's own webhook address under the site's base URI (DEFAULT_URI). */
    public function webhookUrl(string $baseUri): string
    {
        return rtrim($baseUri, '/').self::WEBHOOK_PATH.$this->webhookToken;
    }

    /** Whether the app may write this to the shop: the capability's switch, and only while the connection is active. */
    public function can(ShopCapability|string $capability): bool
    {
        $key = $capability instanceof ShopCapability ? $capability->value : $capability;

        return $this->active && ($this->capabilities[$key] ?? false);
    }

    public function recordWebhook(\DateTimeImmutable $at): void
    {
        $this->lastWebhookAt = $at;
    }

    public function recordImport(\DateTimeImmutable $at): void
    {
        $this->lastImportAt = $at;
    }

    /**
     * A pull ran: on success the cursor moves to the newest modification seen (never back), on failure it stays.
     */
    public function recordPull(\DateTimeImmutable $at, bool $ok, ?\DateTimeImmutable $newestModified = null): void
    {
        $this->lastPullAt = $at;
        if (!$ok) {
            return;
        }
        $this->lastPullOkAt = $at;
        if (null !== $newestModified && (null === $this->pullCursor || $newestModified > $this->pullCursor)) {
            $this->pullCursor = $newestModified;
        }
    }

    public function recordFailure(\DateTimeImmutable $at, string $code, string $message): void
    {
        $this->lastFailureAt = $at;
        $this->lastFailureCode = $code;
        $this->lastFailure = $message;
    }

    /** A failure newer than the last success of any kind: what the Orders warning shows. */
    public function isFailing(): bool
    {
        if (null === $this->lastFailureAt) {
            return false;
        }
        $lastSuccess = max($this->lastImportAt, $this->lastPullOkAt);

        return null === $lastSuccess || $this->lastFailureAt > $lastSuccess;
    }

    /**
     * @param array<string, bool> $given
     *
     * @return array<string, bool>
     */
    private static function capabilityMap(array $given): array
    {
        $map = ShopCapability::none();
        foreach ($map as $key => $_) {
            $map[$key] = (bool) ($given[$key] ?? false);
        }

        return $map;
    }

    public function id(): ?int
    {
        return $this->id;
    }

    public function name(): string
    {
        return $this->name;
    }

    public function siteUrl(): string
    {
        return $this->siteUrl;
    }

    public function sealedConsumerKey(): string
    {
        return $this->consumerKey;
    }

    public function sealedConsumerSecret(): string
    {
        return $this->consumerSecret;
    }

    public function webhookToken(): string
    {
        return $this->webhookToken;
    }

    public function sealedWebhookSecret(): string
    {
        return $this->webhookSecret;
    }

    public function isActive(): bool
    {
        return $this->active;
    }

    public function warehouse(): Warehouse
    {
        return $this->warehouse;
    }

    public function emailsPrinter(): bool
    {
        return $this->emailPrinter;
    }

    /** @return array<string, bool> */
    public function capabilities(): array
    {
        return $this->capabilities;
    }

    public function pullCursor(): ?\DateTimeImmutable
    {
        return $this->pullCursor;
    }

    public function lastWebhookAt(): ?\DateTimeImmutable
    {
        return $this->lastWebhookAt;
    }

    public function lastImportAt(): ?\DateTimeImmutable
    {
        return $this->lastImportAt;
    }

    public function lastPullAt(): ?\DateTimeImmutable
    {
        return $this->lastPullAt;
    }

    public function lastPullOkAt(): ?\DateTimeImmutable
    {
        return $this->lastPullOkAt;
    }

    public function lastFailureAt(): ?\DateTimeImmutable
    {
        return $this->lastFailureAt;
    }

    public function lastFailureCode(): ?string
    {
        return $this->lastFailureCode;
    }

    public function lastFailure(): ?string
    {
        return $this->lastFailure;
    }

    public function createdAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function updatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }
}
