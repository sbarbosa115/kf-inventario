import React from 'react';
import PropTypes from 'prop-types';
import CustomerHandler from '../CustomerHandler/CustomerHandler';

export default function New({ customer, locations }) {
  return <CustomerHandler customer={customer} locations={locations} />;
}

New.propTypes = {
  customer: PropTypes.shape({}).isRequired,
  locations: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};
