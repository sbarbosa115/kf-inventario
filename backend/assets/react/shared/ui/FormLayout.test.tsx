import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {Button} from './Button';
import {ActionBar, FormLayout, FormSection} from './FormLayout';

describe('FormLayout', () => {
  it('groups fields in titled sections and submits from the action bar', async () => {
    const onSubmit = vi.fn((event: {preventDefault: () => void}) =>
      event.preventDefault(),
    );
    render(
      <FormLayout columns={2} onSubmit={onSubmit} label="Order">
        <FormSection title="Customer" description="Who it is for">
          <input aria-label="Email" />
        </FormSection>
        <ActionBar
          status="3 things missing"
          secondary={<Button variant="ghost">Cancel</Button>}
          primary={
            <Button variant="primary" type="submit">
              Create order
            </Button>
          }
        />
      </FormLayout>,
    );

    expect(screen.getByRole('form', {name: 'Order'})).toHaveClass(
      'kf-form--two',
    );
    expect(screen.getByRole('region', {name: 'Customer'})).toHaveTextContent(
      'Who it is for',
    );
    expect(screen.getByText('3 things missing')).toHaveAttribute(
      'aria-live',
      'polite',
    );
    await userEvent.click(screen.getByRole('button', {name: 'Create order'}));
    expect(onSubmit).toHaveBeenCalled();
  });
});
