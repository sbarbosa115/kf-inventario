import {useState, type FormEvent} from 'react';
import {useNavigate} from 'react-router-dom';
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
import {
  ActionBar,
  Button,
  Field,
  FormLayout,
  FormSection,
  useToast,
} from '@/shared/ui';

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
  const toast = useToast();
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
      toast.success(t(customer ? 'customers.updated' : 'customers.created'));
      navigate('/admin/customers');
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
    <FormLayout
      onSubmit={submit}
      label={t(
        customer ? 'customers.form.editTitle' : 'customers.form.newTitle',
      )}
    >
      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}
      <FormSection
        title={t('customers.form.contact')}
        description={t('customers.form.contactHint')}
      >
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
            <Field
              label={t('customers.form.lastName')}
              error={errors.last_name}
            >
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
                type="tel"
                className="form-control"
                value={values.phone}
                maxLength={255}
                onChange={(event) => set('phone', event.target.value)}
              />
            </Field>
          </div>
        </div>
      </FormSection>
      <FormSection
        title={t('customers.form.addresses')}
        description={t('customers.form.addressesHint')}
      >
        <AddressForm
          addresses={values.addresses}
          locations={locations}
          showErrors={attempted}
          onChange={(addresses) => set('addresses', addresses)}
        />
      </FormSection>
      <ActionBar
        secondary={
          <Button variant="ghost" to="/admin/customers">
            {t('common.cancel')}
          </Button>
        }
        primary={
          <Button variant="primary" type="submit" loading={busy}>
            {t('common.save')}
          </Button>
        }
      />
    </FormLayout>
  );
}
