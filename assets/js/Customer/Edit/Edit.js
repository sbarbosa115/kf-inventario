import React from 'react';
import PropTypes from 'prop-types';
import CustomerHandler from '../CustomerHandler/CustomerHandler';

const Edit = (props) => {
  const { customer, locations } = props;
  return (
    <div>
      <CustomerHandler customer={customer} locations={locations} />
    </div>
  );
}

export default CustomerHandler;

Edit.propTypes = {
  customer: PropTypes.shape({}).isRequired,
  locations: PropTypes.instanceOf(Array).isRequired,
};
