<?php

namespace App\Settings\Domain\Model;

/**
 * The rows of app_setting (docs/pdr/prd-shops-settings.md, "Data model"). A key not listed here is not read.
 */
final class SettingKey
{
    /** The whole mailer DSN, sealed (it holds the SMTP password). */
    public const EMAIL_DSN = 'email.dsn';
    public const EMAIL_FROM_ADDRESS = 'email.from_address';
    public const EMAIL_FROM_NAME = 'email.from_name';
    public const EMAIL_PRINTER_ADDRESS = 'email.printer_address';
    /** A JSON list of addresses. */
    public const EMAIL_CC = 'email.cc';
    public const ANALYTICS_GA4_ID = 'analytics.ga4_id';
    public const ANALYTICS_CLARITY_ID = 'analytics.clarity_id';
    /** "1"/"0"; no row = on (Decisions 8: the legacy URL keeps working after the deploy). */
    public const WEBHOOKS_LEGACY_ENABLED = 'webhooks.legacy_enabled';
    /** Hits on the legacy URL since it was turned off, and the last one. */
    public const WEBHOOKS_LEGACY_HITS = 'webhooks.legacy_hits';
    public const WEBHOOKS_LEGACY_LAST_HIT_AT = 'webhooks.legacy_last_hit_at';
    /** When the catch-up pull last ran over the connections (app:shops:pull). */
    public const SHOPS_LAST_PULL_AT = 'shops.last_pull_at';

    private function __construct()
    {
    }
}
