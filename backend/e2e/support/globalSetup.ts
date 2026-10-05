import {request} from '@playwright/test';

/** Before any spec: the stack answers and holds the fixtures (e2e/prepare.sh): the admin account signs in. */
export default async function globalSetup(): Promise<void> {
  const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
  const api = await request.newContext({baseURL});
  const answer = await api.post('/api/v1/auth/login', {
    data: {username: 'sbarbosa115', password: '123456'},
    headers: {Origin: new URL(baseURL).origin},
  });
  if (!answer.ok()) {
    throw new Error(
      `The stack at ${baseURL} has no fixture admin (sign-in answered ${answer.status()}). Run e2e/smoke.sh, which prepares it.`,
    );
  }
  await api.dispose();
}
