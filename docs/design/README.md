# KF Inventory design system

The plan and its reasons are in [`docs/pdr/prd-redesign.md`](../pdr/prd-redesign.md). This file is the reference
the screens are built from.

## Brand

- `backend/public/images/kf-mark.svg`: the KF mark traced from [`brand/kf-logo-180.png`](brand/kf-logo-180.png)
  (the site icon of kfvintagejdm.com): ring `#23241c`, disc `#5d7b2b`, white italic "KF", flat. A true vector file
  from the owner replaces the trace when there is one.
- `backend/public/favicon.svg` (the same mark), `backend/public/favicon.ico` (16 and 32 px, rendered from the SVG),
  `backend/public/apple-touch-icon.png` (the 180 px reference PNG itself).

## Licences of what the redesign adds

| Package | Version | Licence | Used for |
|---|---|---|---|
| `@fontsource-variable/geist` | 5.3 | OFL-1.1 | the UI font, self-hosted |
| `@fontsource-variable/geist-mono` | 5.3 | OFL-1.1 | codes, numbers in scan lists |
| `@zxing/browser` | 0.2.1 | MIT | camera barcode reading where the browser has no `BarcodeDetector` |
| `@zxing/library` | 0.23 | Apache-2.0 | the decoders `@zxing/browser` uses |
