import {apiDelete, apiGet, apiPost, apiPut, type Schema} from '@/shared/api';

// Settings (docs/pdr/prd-shops-settings.md, "API changes" › Settings): ROLE_ADMIN, except the public IDs and the
// quick phrases' read. Item 0 serves public, GET email and webhooks; item 3 the rest (501 until then).

export type PublicSettings = Schema<'PublicSettingsOutput'>;
export type EmailSettings = Schema<'EmailSettingsOutput'>;
export type EmailSources = Schema<'EmailSourcesOutput'>;
export type AnalyticsSettings = Schema<'AnalyticsSettingsOutput'>;
export type WebhookSettings = Schema<'WebhookSettingsOutput'>;
export type QuickPhrase = Schema<'QuickPhraseOutput'>;
export type TestEmailResult = Schema<'TestEmailResultOutput'>;

/** What Settings › Email sends (the request bodies are not in the OpenAPI schema). A blank password keeps the saved one. */
export interface EmailSettingsPayload {
  host: string;
  port: number | null;
  user: string;
  password?: string;
  encryption: 'tls' | 'ssl' | 'none';
  from_address: string;
  from_name: string;
  printer_address: string;
  cc: string[];
}

export interface AnalyticsSettingsPayload {
  ga4_measurement_id: string;
  clarity_project_id: string;
}

export interface QuickPhrasePayload {
  text: string;
  active: boolean;
}

export const getPublicSettings = () => apiGet<PublicSettings>('/settings/public');

export const getEmailSettings = () => apiGet<EmailSettings>('/settings/email');

export const saveEmailSettings = (payload: EmailSettingsPayload) =>
  apiPut<EmailSettings>('/settings/email', payload);

/** Sends "KF Inventory test email" at once through the effective server; 502 smtp_failed says why it could not. */
export const sendTestEmail = (to: string) =>
  apiPost<TestEmailResult>('/settings/email/test', {to});

export const getAnalyticsSettings = () =>
  apiGet<AnalyticsSettings>('/settings/analytics');

export const saveAnalyticsSettings = (payload: AnalyticsSettingsPayload) =>
  apiPut<AnalyticsSettings>('/settings/analytics', payload);

export const getWebhookSettings = () =>
  apiGet<WebhookSettings>('/settings/webhooks');

/** Turns the legacy webhook URL off (410 from then on; its hit counter starts at 0) or back on. */
export const saveWebhookSettings = (legacyEnabled: boolean) =>
  apiPut<WebhookSettings>('/settings/webhooks', {
    legacy_enabled: legacyEnabled,
  });

/** The active phrases in order; `all` (admins): the inactive ones too. */
export const listQuickPhrases = (all = false) =>
  apiGet<QuickPhrase[]>(`/settings/quick-phrases${all ? '?all=1' : ''}`);

export const createQuickPhrase = (payload: QuickPhrasePayload) =>
  apiPost<QuickPhrase>('/settings/quick-phrases', payload);

export const updateQuickPhrase = (id: number, payload: QuickPhrasePayload) =>
  apiPut<QuickPhrase>(`/settings/quick-phrases/${id}`, payload);

export const deleteQuickPhrase = (id: number) =>
  apiDelete(`/settings/quick-phrases/${id}`);

export const reorderQuickPhrases = (ids: number[]) =>
  apiPut<QuickPhrase[]>('/settings/quick-phrases/order', {ids});
