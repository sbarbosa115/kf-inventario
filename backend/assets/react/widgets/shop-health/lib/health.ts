import type {ShopConnection, ShopHealth} from '@/entities/shop-connection';
import type {WebhookSettings} from '@/entities/settings';
import type {Translate} from '@/shared/i18n';

/** A problem worth a line on Orders: what it says and where it is fixed. */
export interface ShopIssue {
  key: string;
  text: string;
  href: string;
}

const time = (iso: string | null | undefined): number =>
  iso ? Date.parse(iso) : Number.NaN;

/** The last time the connection worked: an order imported (webhook or pull) or a successful check. */
export function lastSuccessAt(health: ShopHealth): number {
  const times = [time(health.last_import_at), time(health.last_pull_ok_at)];
  const known = times.filter((t) => !Number.isNaN(t));
  return known.length === 0 ? Number.NaN : Math.max(...known);
}

/** Whether the last failure is still the news: it happened after the last success (or nothing ever worked). */
export function failureIsCurrent(health: ShopHealth): boolean {
  const failure = time(health.last_failure_at);
  if (Number.isNaN(failure)) return false;
  const success = lastSuccessAt(health);
  return Number.isNaN(success) || failure > success;
}

/** A failure code in words ("Keys are read-only"); an unknown code reads "The last attempt failed". */
export function failureLabel(code: string | null | undefined, t: Translate) {
  const key = `shops.failures.${code ?? ''}`;
  const label = code ? t(key) : key;
  return label === key ? t('shops.failures.other') : label;
}

/**
 * An active connection's line, or null when it is healthy: the orders it could not place, the updates that did not
 * reach the shop, and a failure newer than its last success (unless the failed deliveries already explain it). The
 * link goes where it is fixed: the connection's failed deliveries, else its form.
 */
export function connectionIssue(
  shop: ShopConnection,
  t: Translate,
): ShopIssue | null {
  if (!shop.active) return null;
  const {health} = shop;
  const parts: string[] = [];
  if (health.failed_deliveries > 0) {
    parts.push(t('shops.health.notPlaced', {count: health.failed_deliveries}));
  }
  if (health.failed_pushes > 0) {
    parts.push(t('shops.health.notPushed', {count: health.failed_pushes}));
  }
  if (health.failed_deliveries === 0 && failureIsCurrent(health)) {
    parts.push(failureLabel(health.last_failure_code, t));
  }
  if (parts.length === 0) return null;
  return {
    key: `shop-${shop.id}`,
    text: t('shops.health.line', {name: shop.name, parts: parts.join(' · ')}),
    href:
      health.failed_deliveries > 0
        ? `/admin/settings/shops/${shop.id}/deliveries`
        : `/admin/settings/shops/${shop.id}`,
  };
}

/** The old webhook URL (a 410 tombstone) was reached since the deploy: a shop still points at it. */
export function legacyIssue(
  webhooks: WebhookSettings | undefined,
  t: Translate,
): ShopIssue | null {
  if (!webhooks || webhooks.legacy_hits <= 0) return null;
  return {
    key: 'legacy',
    text: t('shops.health.legacy', {count: webhooks.legacy_hits}),
    href: '/admin/settings',
  };
}

/** Every line, the connections by name then the old URL. */
export function shopIssues(
  shops: ShopConnection[],
  webhooks: WebhookSettings | undefined,
  t: Translate,
): ShopIssue[] {
  const legacy = legacyIssue(webhooks, t);
  return [
    ...shops.flatMap((shop) => connectionIssue(shop, t) ?? []),
    ...(legacy ? [legacy] : []),
  ];
}
