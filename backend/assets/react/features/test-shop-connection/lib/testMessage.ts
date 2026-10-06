import type {ShopTestResult} from '@/entities/shop-connection';
import type {Translate} from '@/shared/i18n';

/** A test's answer in one sentence, for a toast: "Kfvintage answered: KF Vintage, WooCommerce 8.9.0." or why not. */
export function testMessage(
  name: string,
  result: ShopTestResult,
  t: Translate,
): {ok: boolean; text: string} {
  const {rest} = result;
  return rest.ok
    ? {
        ok: true,
        text: t('shops.test.answered', {
          name,
          store: rest.store_name ?? '—',
          version: rest.wc_version ?? '—',
        }),
      }
    : {
        ok: false,
        text: t('shops.test.notAnswered', {
          name,
          error: rest.error ?? t('shops.failures.unreachable'),
        }),
      };
}
