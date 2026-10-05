import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import CreatableSelect from 'react-select/creatable';
import LocationManager from '../../Services/LocationManager';

const isValidNewOption = (inputValue, _value, selectOptions) => (
  !(inputValue.trim().length === 0 || selectOptions.find(option => option.name === inputValue))
);

export default function CustomerHandler({ customer: initialCustomer, locations }) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [loading, setLoading] = useState(false);
  const locationManager = useMemo(() => new LocationManager(locations), [locations]);

  const updateField = (field, value) =>
    setCustomer(prev => ({ ...prev, [field]: value }));

  const updateAddress = (addressKey, field, value) =>
    setCustomer(prev => {
      const addresses = [...prev.addresses];
      addresses[addressKey] = { ...addresses[addressKey], [field]: value };
      return { ...prev, addresses };
    });

  const addAddress = () =>
    setCustomer(prev => ({
      ...prev,
      addresses: [...prev.addresses, LocationManager.createEmptyAddress()],
    }));

  const removeAddress = (indexToRemove) =>
    setCustomer(prev => ({
      ...prev,
      addresses: prev.addresses.filter((_, i) => i !== indexToRemove),
    }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    axios.post(Routing.generate('customer_update', null), customer).then(() => {
      window.location.href = Routing.generate('customer_index', null);
    });
  };

  const addressFields = customer.addresses.map((address, addressKey) => (
    // eslint-disable-next-line react/no-array-index-key
    <div key={`addresses-${addressKey}`}>
      <hr />
      <div className="form-row">
        <div className="col-md-1 text-center">
          <button type="button" className="btn btn-success" onClick={addAddress}>
            <i className="fas fa-plus" />
          </button>
          {' '}
          {addressKey !== 0 && (
            <button type="button" className="btn btn-danger" onClick={() => removeAddress(addressKey)}>
              <i className="fas fa-minus-circle" />
            </button>
          )}
        </div>
        <div className="form-group col-md-5">
          <label htmlFor="name" className="required">
            {Translator.trans('customer.edit.address')}
          </label>
          <input
            type="text"
            required="required"
            className="form-control"
            placeholder={Translator.trans('customer.edit.address')}
            defaultValue={address.address}
            onChange={(e) => updateAddress(addressKey, 'address', e.target.value)}
          />
        </div>
        <div className="form-group col-md-6">
          <label htmlFor="zipCode" className="required">
            {Translator.trans('customer.edit.zip_code')}
          </label>
          <input
            type="text"
            required="required"
            className="form-control"
            placeholder={Translator.trans('customer.edit.zip_code')}
            defaultValue={address.zipCode}
            onChange={(e) => updateAddress(addressKey, 'zipCode', e.target.value)}
          />
        </div>
      </div>
      <div className="form-row">
        <div className="offset-md-1" />
        <div className="form-group col-md-5">
          <label htmlFor="country" className="required">
            {Translator.trans('customer.edit.country')}
          </label>
          <CreatableSelect
            isValidNewOption={isValidNewOption}
            getOptionLabel={option => option.name}
            getOptionValue={option => option.id}
            placeholder={Translator.trans('customer.edit.country')}
            getNewOptionData={(inputValue, optionLabel) => ({ id: null, name: optionLabel })}
            defaultValue={locationManager.getCountryById(
              address.city.state.country.id,
              address.city.state.country.name,
            )}
            options={locationManager.getCountries()}
            onChange={(selected) => {
              const country = locationManager.getCountryById(selected.id, selected.name);
              setCustomer(prev => {
                const addresses = [...prev.addresses];
                addresses[addressKey] = {
                  ...addresses[addressKey],
                  city: { id: null, name: null, state: { id: null, name: null, country: { id: country.id, name: country.name } } },
                };
                return { ...prev, addresses };
              });
            }}
          />
        </div>
        <div className="form-group col-md-6">
          <label htmlFor="state" className="required">
            {Translator.trans('customer.edit.state')}
          </label>
          <CreatableSelect
            isValidNewOption={isValidNewOption}
            getOptionLabel={option => option.name}
            getOptionValue={option => option.id}
            placeholder={Translator.trans('customer.edit.state')}
            getNewOptionData={(inputValue, optionLabel) => ({ id: null, name: optionLabel })}
            defaultValue={locationManager.getStateById(
              address.city.state.id,
              address.city.state.name,
            )}
            options={locationManager.getStatesByCountryId(address.city.state.country.id)}
            onChange={(selected) => {
              const state = locationManager.getStateById(selected.id, selected.name);
              setCustomer(prev => {
                const addresses = [...prev.addresses];
                addresses[addressKey] = {
                  ...addresses[addressKey],
                  city: { ...addresses[addressKey].city, state: { ...addresses[addressKey].city.state, id: state.id, name: state.name } },
                };
                return { ...prev, addresses };
              });
            }}
          />
        </div>
      </div>
      <div className="form-row">
        <div className="offset-md-1" />
        <div className="form-group col-md-5">
          <label htmlFor="city" className="required">
            {Translator.trans('customer.edit.city')}
          </label>
          <CreatableSelect
            isValidNewOption={isValidNewOption}
            getOptionLabel={option => option.name}
            getOptionValue={option => option.id}
            placeholder={Translator.trans('customer.edit.city')}
            getNewOptionData={(inputValue, optionLabel) => ({ id: null, name: optionLabel })}
            defaultValue={locationManager.getCityById(address.city.id, address.city.name)}
            options={locationManager.getCitiesByState(address.city.state.id)}
            onChange={(selected) => {
              const city = locationManager.getCityById(selected.id, selected.name);
              setCustomer(prev => {
                const addresses = [...prev.addresses];
                addresses[addressKey] = {
                  ...addresses[addressKey],
                  city: { ...addresses[addressKey].city, id: city.id, name: city.name },
                };
                return { ...prev, addresses };
              });
            }}
          />
        </div>
      </div>
    </div>
  ));

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group col-md-6">
          <label htmlFor="firstName" className="required">
            {Translator.trans('customer.edit.name')}
          </label>
          <input
            type="text"
            required="required"
            className="form-control"
            placeholder={Translator.trans('customer.edit.name')}
            defaultValue={customer.firstName || ''}
            onChange={(e) => updateField('firstName', e.target.value)}
          />
        </div>
        <div className="form-group col-md-6">
          <label htmlFor="lastName" className="required">
            {Translator.trans('customer.edit.last_name')}
          </label>
          <input
            type="text"
            required="required"
            className="form-control"
            placeholder={Translator.trans('customer.edit.last_name')}
            defaultValue={customer.lastName || ''}
            onChange={(e) => updateField('lastName', e.target.value)}
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group col-md-6">
          <label htmlFor="email" className="required">
            {Translator.trans('customer.edit.email')}
          </label>
          <input
            type="email"
            required="required"
            className="form-control"
            placeholder={Translator.trans('customer.edit.email')}
            defaultValue={customer.email || ''}
            onChange={(e) => updateField('email', e.target.value)}
          />
        </div>
        <div className="form-group col-md-6">
          <label htmlFor="phone" className="required">
            {Translator.trans('customer.edit.phone')}
          </label>
          <input
            type="text"
            required="required"
            className="form-control"
            placeholder={Translator.trans('customer.edit.phone')}
            defaultValue={customer.phone || ''}
            onChange={(e) => updateField('phone', e.target.value)}
          />
        </div>
      </div>
      <div>
        {addressFields}
        {addressFields.length === 0 && (
          <button type="button" className="btn btn-success" onClick={addAddress}>
            {Translator.trans('customer.new.add_address')}
            {' '}
            <i className="fas fa-plus" />
          </button>
        )}
      </div>
      <br />
      <div className="form-row">
        <div className="form-group col-md-6">
          <a className="btn btn-danger btn-block" href={Routing.generate('customer_index', null)} role="button">
            {Translator.trans('cancel')}
          </a>
        </div>
        <div className="form-group col-md-6">
          <button
            className={`btn btn-success btn-block${loading ? ' disabled' : ''}`}
            type="submit"
          >
            {Translator.trans('save')}
          </button>
        </div>
      </div>
    </form>
  );
}

CustomerHandler.propTypes = {
  customer: PropTypes.shape({}).isRequired,
  locations: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};
