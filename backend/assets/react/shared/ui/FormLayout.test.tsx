import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type FormEvent} from 'react';
import {Button} from './Button';
import {Field} from './Field';
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

  it('keeps the action bar in the page instead of over it when told it has nothing to do yet', () => {
    const {rerender} = render(
      <ActionBar primary={<Button variant="primary">Add</Button>} />,
    );
    const bar = () =>
      screen.getByRole('button', {name: 'Add'}).closest('.kf-action-bar');
    expect(bar(), 'sticky by default').not.toHaveClass('kf-action-bar--static');

    rerender(
      <ActionBar
        sticky={false}
        primary={<Button variant="primary">Add</Button>}
      />,
    );
    expect(bar()).toHaveClass('kf-action-bar--static');
  });

  it('moves to the first field a refused save marks, even when the answer comes later', async () => {
    function Contact() {
      const [errors, setErrors] = useState<Record<string, string>>({});
      const save = (event: FormEvent) => {
        event.preventDefault();
        // The server answers later: the fields are marked after the submit has returned.
        setTimeout(
          () =>
            setErrors({
              phone: 'This value should not be blank.',
              zip: 'Required.',
            }),
          10,
        );
      };
      return (
        <FormLayout onSubmit={save} label="Customer">
          <Field label="Name">
            <input />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <input />
          </Field>
          <Field label="Zip" error={errors.zip}>
            <input />
          </Field>
          <ActionBar
            primary={
              <Button variant="primary" type="submit">
                Save
              </Button>
            }
          />
        </FormLayout>
      );
    }
    render(<Contact />);

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(
      await screen.findByText('This value should not be blank.'),
    ).toBeInTheDocument();
    // Save is at the bottom of a phone's screen and the field above, out of sight: it comes to the finger.
    expect(screen.getByLabelText('Phone')).toHaveFocus();
  });

  it('leaves the focus where the person is typing', async () => {
    function Live() {
      const [error, setError] = useState<string | null>(null);
      return (
        <FormLayout onSubmit={(event) => event.preventDefault()} label="Live">
          <Field label="Code" error={error}>
            <input
              onChange={(e) =>
                setError(e.target.value === 'x' ? 'Not x.' : null)
              }
            />
          </Field>
          <Field label="Title">
            <input />
          </Field>
        </FormLayout>
      );
    }
    render(<Live />);
    await userEvent.type(screen.getByLabelText('Title'), 'abc');
    await userEvent.type(screen.getByLabelText('Code'), 'x');
    await userEvent.click(screen.getByLabelText('Title'));

    expect(
      screen.getByLabelText('Title'),
      'no save was asked: nothing moves',
    ).toHaveFocus();
  });
});
