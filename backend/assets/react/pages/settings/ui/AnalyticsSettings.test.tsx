import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {AnalyticsSettings} from './AnalyticsSettings';

const renderTab = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <AnalyticsSettings />
      </ToastProvider>
    </MemoryRouter>,
  );

describe('Settings › Analytics', () => {
  it('shows the saved ids with their help and where the tools load', async () => {
    fakeApi({
      'GET /settings/analytics': [
        200,
        {ga4_measurement_id: 'G-ABC1234', clarity_project_id: null},
      ],
    });
    renderTab();

    expect(
      await screen.findByLabelText('Google Analytics 4 Measurement ID'),
    ).toHaveValue('G-ABC1234');
    expect(screen.getByLabelText('Microsoft Clarity Project ID')).toHaveValue(
      '',
    );
    expect(screen.getByText(/G-XXXXXXX, from GA4/)).toBeInTheDocument();
    expect(screen.getByText(/not on the sign-in page/)).toBeInTheDocument();
  });

  it('refuses a bad id in place and does not call the API', async () => {
    const api = fakeApi({
      'GET /settings/analytics': [
        200,
        {ga4_measurement_id: null, clarity_project_id: null},
      ],
    });
    renderTab();

    await userEvent.type(
      await screen.findByLabelText('Google Analytics 4 Measurement ID'),
      'UA-123',
    );
    await userEvent.type(
      screen.getByLabelText('Microsoft Clarity Project ID'),
      'NOT VALID',
    );
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(
      screen.getByText(/A GA4 ID looks like G-ABC1234/),
    ).toBeInTheDocument();
    expect(screen.getByText(/A Clarity ID is 6 to 20/)).toBeInTheDocument();
    expect(api.calls.filter((call) => call.method === 'PUT')).toEqual([]);
  });

  it('saves valid ids, trimmed, and says they load on the next page', async () => {
    const api = fakeApi({
      'GET /settings/analytics': [
        200,
        {ga4_measurement_id: null, clarity_project_id: null},
      ],
      'PUT /settings/analytics': [
        200,
        {ga4_measurement_id: 'G-ABC1234', clarity_project_id: 'abcdef12'},
      ],
    });
    renderTab();

    await userEvent.type(
      await screen.findByLabelText('Google Analytics 4 Measurement ID'),
      ' G-ABC1234 ',
    );
    await userEvent.type(
      screen.getByLabelText('Microsoft Clarity Project ID'),
      'abcdef12',
    );
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'load on the next page you open',
    );
    expect(api.calls.find((call) => call.method === 'PUT')?.body).toEqual({
      ga4_measurement_id: 'G-ABC1234',
      clarity_project_id: 'abcdef12',
    });
  });

  it('empty fields clear the setting (sent as empty strings)', async () => {
    const api = fakeApi({
      'GET /settings/analytics': [
        200,
        {ga4_measurement_id: 'G-ABC1234', clarity_project_id: 'abcdef12'},
      ],
      'PUT /settings/analytics': [
        200,
        {ga4_measurement_id: null, clarity_project_id: null},
      ],
    });
    renderTab();

    await userEvent.clear(
      await screen.findByLabelText('Google Analytics 4 Measurement ID'),
    );
    await userEvent.clear(
      screen.getByLabelText('Microsoft Clarity Project ID'),
    );
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await screen.findByRole('status');
    expect(api.calls.find((call) => call.method === 'PUT')?.body).toEqual({
      ga4_measurement_id: '',
      clarity_project_id: '',
    });
  });
});
