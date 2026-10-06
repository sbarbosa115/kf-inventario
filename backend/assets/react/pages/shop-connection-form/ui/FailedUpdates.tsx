import {useEffect, useRef, useState} from 'react';
import {useLocation} from 'react-router-dom';
import {
  listOutbox,
  retryOutbox,
  type ShopOutboxEntry,
} from '@/entities/shop-connection';
import {failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useFormat, useLoad} from '@/shared/lib';
import {Button, DataTable, useToast, type Column} from '@/shared/ui';

/**
 * The updates the app could not write to the shop after every retry (the outbox's failed rows), each with Retry
 * (queued again). The cards' "1 failed update" lands here (#failed-updates).
 */
export function FailedUpdates({shopId}: {shopId: number}) {
  const {t} = useTranslation();
  const {dateTime} = useFormat();
  const toast = useToast();
  const location = useLocation();
  const anchor = useRef<HTMLElement>(null);
  const {data, error, reload} = useLoad(
    () => listOutbox(shopId, 'failed'),
    [shopId],
  );
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    if (location.hash === '#failed-updates' && data !== undefined) {
      anchor.current?.scrollIntoView?.({block: 'start'});
    }
  }, [location.hash, data]);

  const retry = async (entry: ShopOutboxEntry) => {
    setBusy(entry.id);
    try {
      await retryOutbox(shopId, entry.id);
      toast.success(
        t('shops.updates.retried', {code: entry.order.code ?? entry.order.id}),
      );
      reload();
    } catch (failure) {
      toast.error(failureMessage(failure, t));
    } finally {
      setBusy(null);
    }
  };

  const columns: Column<ShopOutboxEntry>[] = [
    {
      key: 'order',
      header: t('shops.updates.order'),
      render: (entry) => (
        <span className="kf-mono">{entry.order.code ?? entry.order.id}</span>
      ),
    },
    {
      key: 'what',
      header: t('shops.updates.what'),
      render: (entry) => {
        const key = `shops.updates.capabilities.${entry.capability}`;
        const label = t(key);
        return label === key ? entry.capability : label;
      },
    },
    {
      key: 'error',
      header: t('shops.updates.error'),
      render: (entry) => entry.last_error ?? '—',
    },
    {
      key: 'since',
      header: t('shops.updates.since'),
      render: (entry) => (
        <span className="text-nowrap">{dateTime(entry.created_at)}</span>
      ),
    },
  ];

  return (
    <section
      className="kf-shop-form__updates"
      id="failed-updates"
      aria-labelledby="failed-updates-title"
      ref={anchor}
    >
      <h2 className="kf-shop-form__updates-title" id="failed-updates-title">
        {t('shops.updates.title')}
      </h2>
      <DataTable
        columns={columns}
        rows={data}
        rowKey={(entry) => entry.id}
        rowLabel={(entry) => String(entry.order.code ?? entry.order.id)}
        error={error}
        onRetry={reload}
        searchable={false}
        pageSize={0}
        skeletonRows={2}
        emptyMessage={t('shops.updates.empty')}
        primaryAction={(entry) => (
          <Button
            size="sm"
            icon="fa-redo"
            loading={busy === entry.id}
            onClick={() => void retry(entry)}
          >
            {t('shops.updates.retry')}
          </Button>
        )}
        cardTitle={(entry) => (
          <span className="kf-mono">{entry.order.code ?? entry.order.id}</span>
        )}
      />
    </section>
  );
}
