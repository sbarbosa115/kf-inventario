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
import {Button} from '@/shared/ui';
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
 * cannot be removed; each address is a card (its number and, when it has one, its type), and "Add address" sits
 * under the cards. With none, the widget offers to add one. Used by the customer form and the order form.
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
          onRemove={index === 0 ? undefined : () => remove(index)}
        />
      ))}
      <Button icon="fa-plus" onClick={add}>
        {t('address.add')}
      </Button>
    </div>
  );
}

function AddressRow({
  number,
  address,
  manager,
  showErrors,
  onChange,
  onRemove,
}: {
  number: number;
  address: AddressValue;
  manager: LocationManager;
  showErrors: boolean;
  onChange: (changes: Partial<AddressValue>) => void;
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
    placeholder: '',
  };

  const type =
    address.address_type === 1
      ? t('address.type.billing')
      : address.address_type === 2
        ? t('address.type.shipping')
        : null;
  const heading = type
    ? t('address.groupTyped', {number, type})
    : t('address.group', {number});

  return (
    <fieldset className="address-form__card" aria-label={heading}>
      <div className="address-form__head">
        <span className="address-form__title" aria-hidden="true">
          {heading}
        </span>
        {onRemove && (
          <Button variant="ghost" size="sm" icon="fa-times" onClick={onRemove}>
            {t('address.remove')}
          </Button>
        )}
      </div>
      <div className="form-row">
        <div className="form-group col-md-8">
          <label htmlFor={`${id}-address`}>{t('address.address')}</label>
          <input
            id={`${id}-address`}
            className={`form-control${showErrors && address.address.trim() === '' ? ' is-invalid' : ''}`}
            value={address.address}
            maxLength={255}
            onChange={(event) => onChange({address: event.target.value})}
          />
          {showErrors && address.address.trim() === '' && (
            <div className="invalid-feedback">{required}</div>
          )}
        </div>
        <div className="form-group col-md-4">
          <label htmlFor={`${id}-zip`}>{t('address.zipCode')}</label>
          <input
            id={`${id}-zip`}
            className={`form-control${showErrors && address.zip_code.trim() === '' ? ' is-invalid' : ''}`}
            value={address.zip_code}
            maxLength={255}
            onChange={(event) => onChange({zip_code: event.target.value})}
          />
          {showErrors && address.zip_code.trim() === '' && (
            <div className="invalid-feedback">{required}</div>
          )}
        </div>
      </div>
      <div className="form-row">
        <div className="form-group col-md-4">
          <label htmlFor={`${id}-country`}>{t('address.country')}</label>
          <CreatableSelect<PlaceValue>
            {...common}
            inputId={`${id}-country`}
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
        <div className="form-group col-md-4">
          <label htmlFor={`${id}-state`}>{t('address.state')}</label>
          <CreatableSelect<PlaceValue>
            {...common}
            inputId={`${id}-state`}
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
        <div className="form-group col-md-4">
          <label htmlFor={`${id}-city`}>{t('address.city')}</label>
          <CreatableSelect<PlaceValue>
            {...common}
            inputId={`${id}-city`}
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
