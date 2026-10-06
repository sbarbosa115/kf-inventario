import React from 'react';
import PropTypes from 'prop-types';
import CustomerHandler from '../CustomerHandler/CustomerHandler';

export default function Edit({ customer, locations }) {
  return <CustomerHandler customer={customer} locations={locations} />;
}

Edit.propTypes = {
  customer: PropTypes.shape({}).isRequired,
  locations: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};
