import {useId, type ReactNode} from 'react';
import type {GroupBase, OptionsOrGroups} from 'react-select';
import CreatableSelect from 'react-select/creatable';
import {
  emptyAddress,
  type AddressValue,
  type PlaceValue,
} from '@/entities/customer';
import {LocationManager, type Country} from '@/entities/location';
import {useTranslation} from '@/shared/i18n';
import './address-form.css';

const NO_PLACE: PlaceValue = {id: null, name: ''};

/** A name is offered as new only when something was typed and no option already has it. */
const isValidNewOption = (
  input: string,
  _value: unknown,
  options: OptionsOrGroups<PlaceValue, GroupBase<PlaceValue>>,
) =>
  input.trim() !== '' &&
  !(options as readonly PlaceValue[]).some(
    (option) => option.name === input.trim(),
  );

/**
 * A customer's addresses: street, zip code and the country → state → city selects, each of which also takes a name
 * that does not exist yet (it goes up with id null and is created when the customer is saved). The first address
 * cannot be removed; with none, the widget offers to add one. Used by the customer form and the order form.
 */
export function AddressForm({
  addresses,
  locations,
  onChange,
  showErrors = false,
}: {
  addresses: AddressValue[];
  locations: Country[];
  onChange: (addresses: AddressValue[]) => void;
  /** Mark the street and the zip code that are still empty (after a first attempt to save). */
  showErrors?: boolean;
}) {
  const {t} = useTranslation();
  const manager = new LocationManager(locations);

  const update = (index: number, changes: Partial<AddressValue>) =>
    onChange(addresses.map((a, i) => (i === index ? {...a, ...changes} : a)));
  const add = () => onChange([...addresses, emptyAddress()]);
  const remove = (index: number) =>
    onChange(addresses.filter((_, i) => i !== index));

  return (
    <div className="address-form">
      {addresses.map((address, index) => (
        <AddressRow
          // The list has no stable key (a new address has no id yet): rows are only added and removed at the end.

          key={index}
          number={index + 1}
          address={address}
          manager={manager}
          showErrors={showErrors}
          onChange={(changes) => update(index, changes)}
          onAdd={add}
          onRemove={index === 0 ? undefined : () => remove(index)}
        />
      ))}
      {addresses.length === 0 && (
        <button type="button" className="btn btn-success" onClick={add}>
          {t('address.add')} <i className="fas fa-plus" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function AddressRow({
  number,
  address,
  manager,
  showErrors,
  onChange,
  onAdd,
  onRemove,
}: {
  number: number;
  address: AddressValue;
  manager: LocationManager;
  showErrors: boolean;
  onChange: (changes: Partial<AddressValue>) => void;
  onAdd: () => void;
  onRemove?: () => void;
}) {
  const {t} = useTranslation();
  const id = useId();
  const required = t('address.required');
  const selected = (place: PlaceValue) => (place.name === '' ? null : place);
  const labelOf = (option: PlaceValue) => option.name;
  const valueOf = (option: PlaceValue) => String(option.id ?? option.name);
  // react-select calls this twice: for the "Create ..." row of the menu (the label is that text) and, once it is
  // picked, for the value itself (the label is what was typed).
  const newOption = (_input: string, label: ReactNode): PlaceValue => ({
    id: null,
    name: String(label),
  });
  const common = {
    isValidNewOption,
    getOptionLabel: labelOf,
    getOptionValue: valueOf,
    getNewOptionData: newOption,
    formatCreateLabel: (name: string) => t('address.create', {name}),
    noOptionsMessage: () => t('address.noOptions'),
    classNamePrefix: 'kf-select',
  };

  return (
    <fieldset
      className="address-form__row"
      aria-label={t('address.group', {number})}
    >
      <hr />
      <div className="form-row">
        <div className="col-md-1 text-center address-form__buttons">
          <button
            type="button"
            className="btn btn-success"
            onClick={onAdd}
            aria-label={t('address.add')}
            title={t('address.add')}
          >
            <i className="fas fa-plus" aria-hidden="true" />
          </button>{' '}
          {onRemove && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={onRemove}
              aria-label={t('address.remove')}
              title={t('address.remove')}
            >
              <i className="fas fa-minus-circle" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="form-group col-md-5">
          <label htmlFor={`${id}-address`}>{t('address.address')}</label>
          <input
            id={`${id}-address`}
            className={`form-control${showErrors && address.address.trim() === '' ? ' is-invalid' : ''}`}
            value={address.address}
            maxLength={255}
            placeholder={t('address.address')}
            onChange={(event) => onChange({address: event.target.value})}
          />
          {showErrors && address.address.trim() === '' && (
            <div className="invalid-feedback">{required}</div>
          )}
        </div>
        <div className="form-group col-md-6">
          <label htmlFor={`${id}-zip`}>{t('address.zipCode')}</label>
          <input
            id={`${id}-zip`}
            className={`form-control${showErrors && address.zip_code.trim() === '' ? ' is-invalid' : ''}`}
            value={address.zip_code}
            maxLength={255}
            placeholder={t('address.zipCode')}
            onChange={(event) => onChange({zip_code: event.target.value})}
          />
          {showErrors && address.zip_code.trim() === '' && (
            <div className="invalid-feedback">{required}</div>
          )}
        </div>
      </div>
      <div className="form-row">
        <div className="col-md-1" />
        <div className="form-group col-md-5">
          <label htmlFor={`${id}-country`}>{t('address.country')}</label>
          <CreatableSelect<PlaceValue>
            {...common}
            inputId={`${id}-country`}
            placeholder={t('address.country')}
            options={manager.countries()}
            value={selected(address.country)}
            onChange={(option) =>
              option &&
              onChange({
                country: {id: option.id, name: option.name},
                state: NO_PLACE,
                city: NO_PLACE,
              })
            }
          />
        </div>
        <div className="form-group col-md-6">
          <label htmlFor={`${id}-state`}>{t('address.state')}</label>
          <CreatableSelect<PlaceValue>
            {...common}
            inputId={`${id}-state`}
            placeholder={t('address.state')}
            options={manager.statesByCountryId(address.country.id)}
            value={selected(address.state)}
            onChange={(option) =>
              option &&
              onChange({
                state: {id: option.id, name: option.name},
                city: NO_PLACE,
              })
            }
          />
        </div>
      </div>
      <div className="form-row">
        <div className="col-md-1" />
        <div className="form-group col-md-5">
          <label htmlFor={`${id}-city`}>{t('address.city')}</label>
          <CreatableSelect<PlaceValue>
            {...common}
            inputId={`${id}-city`}
            placeholder={t('address.city')}
            options={manager.citiesByState(address.state.id)}
            value={selected(address.city)}
            onChange={(option) =>
              option && onChange({city: {id: option.id, name: option.name}})
            }
          />
        </div>
      </div>
    </fieldset>
  );
}
