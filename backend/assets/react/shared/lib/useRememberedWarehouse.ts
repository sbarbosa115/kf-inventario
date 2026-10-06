import {useCallback, useEffect} from 'react';
import {useSearchParams} from 'react-router-dom';
import {readSetting, writeSetting} from './storage';

export const WAREHOUSE_KEY = 'kf.warehouse';

/**
 * The warehouse a screen works on: ?warehouse=<id> when the address names one (and it is remembered), else the one
 * last chosen in this browser, else the first. `pick` changes it and remembers it. undefined while the list loads.
 */
export function useRememberedWarehouse<W extends {id: number}>(
  warehouses: readonly W[] | undefined,
): [W | undefined, (id: number) => void] {
  const [params, setParams] = useSearchParams();
  const fromAddress = Number(params.get('warehouse'));
  const remembered = Number(readSetting(WAREHOUSE_KEY));
  const byId = (id: number) => warehouses?.find((w) => w.id === id);
  const current =
    byId(fromAddress) ?? byId(remembered) ?? (warehouses ?? [])[0];

  const addressKnown = byId(fromAddress) !== undefined;
  useEffect(() => {
    if (addressKnown) writeSetting(WAREHOUSE_KEY, String(fromAddress));
  }, [addressKnown, fromAddress]);

  const pick = useCallback(
    (id: number) => {
      writeSetting(WAREHOUSE_KEY, String(id));
      if (params.has('warehouse')) {
        const next = new URLSearchParams(params);
        next.set('warehouse', String(id));
        setParams(next, {replace: true});
      } else {
        setParams(params, {replace: true});
      }
    },
    [params, setParams],
  );
  return [current, pick];
}
