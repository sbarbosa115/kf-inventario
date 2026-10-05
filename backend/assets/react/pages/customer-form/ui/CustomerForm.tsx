import {useState, type FormEvent} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {
  addressesComplete,
  createCustomer,
  customerFormToPayload,
  customerToForm,
  emptyCustomerForm,
  updateCustomer,
  validateCustomerForm,
  violationsToErrors,
  type Customer,
  type CustomerFormErrors,
  type CustomerFormValues,
} from '@/entities/customer';
import type {Country} from '@/entities/location';
import {AddressForm} from '@/widgets/address-form';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {Field} from '@/shared/ui';

/** The customer's fields and addresses. Without `customer` it creates one; with it, it edits that one. */
export function CustomerForm({
  customer,
  locations,
}: {
  customer?: Customer;
  locations: Country[];
}) {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const [values, setValues] = useState<CustomerFormValues>(() =>
    customer ? customerToForm(customer) : emptyCustomerForm(),
  );
  const [errors, setErrors] = useState<CustomerFormErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof CustomerFormValues>(
    key: K,
    value: CustomerFormValues[K],
  ) => setValues((now) => ({...now, [key]: value}));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);
    setAttempted(true);
    const found = validateCustomerForm(values, t);
    setErrors(found);
    if (Object.keys(found).length > 0 || !addressesComplete(values.addresses)) {
      return;
    }

    setBusy(true);
    try {
      const payload = customerFormToPayload(values);
      if (customer) {
        await updateCustomer(customer.id, payload);
      } else {
        await createCustomer(payload);
      }
      navigate('/admin/customers', {
        state: {saved: customer ? 'updated' : 'created'},
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setErrors(violationsToErrors(error.body));
        setFailure(t('errors.validation_failed'));
      } else if (error instanceof ApiError && error.status === 403) {
        setFailure(t('errors.forbidden'));
      } else if (error instanceof ApiError && error.status === 404) {
        setFailure(t('customers.notFound'));
      } else {
        setFailure(failureMessage(error, t));
      }
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}
      <div className="form-row">
        <div className="col-md-6">
          <Field
            label={t('customers.form.firstName')}
            error={errors.first_name}
          >
            <input
              className="form-control"
              value={values.first_name}
              maxLength={255}
              onChange={(event) => set('first_name', event.target.value)}
            />
          </Field>
        </div>
        <div className="col-md-6">
          <Field label={t('customers.form.lastName')} error={errors.last_name}>
            <input
              className="form-control"
              value={values.last_name}
              maxLength={255}
              onChange={(event) => set('last_name', event.target.value)}
            />
          </Field>
        </div>
      </div>
      <div className="form-row">
        <div className="col-md-6">
          <Field label={t('customers.form.email')} error={errors.email}>
            <input
              type="email"
              className="form-control"
              value={values.email}
              maxLength={255}
              onChange={(event) => set('email', event.target.value)}
            />
          </Field>
        </div>
        <div className="col-md-6">
          <Field label={t('customers.form.phone')} error={errors.phone}>
            <input
              className="form-control"
              value={values.phone}
              maxLength={255}
              onChange={(event) => set('phone', event.target.value)}
            />
          </Field>
        </div>
      </div>
      <AddressForm
        addresses={values.addresses}
        locations={locations}
        showErrors={attempted}
        onChange={(addresses) => set('addresses', addresses)}
      />
      <div className="form-row mt-3">
        <div className="col-md-6 mb-2">
          <Link to="/admin/customers" className="btn btn-danger btn-block">
            {t('common.cancel')}
          </Link>
        </div>
        <div className="col-md-6 mb-2">
          <button
            type="submit"
            className="btn btn-success btn-block"
            disabled={busy}
          >
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </form>
  );
}
