import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {PasswordField} from './PasswordField';

function Form() {
  const [value, setValue] = useState('');
  return <PasswordField label="Password" value={value} onChange={setValue} />;
}

describe('PasswordField', () => {
  it('shows and hides the password', async () => {
    render(<Form />);
    const input = screen.getByLabelText('Password');
    await userEvent.type(input, 'secret');

    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', {name: 'Show password'}));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', {name: 'Hide password'})).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('says when Caps Lock is on', () => {
    render(<Form />);
    const input = screen.getByLabelText('Password');

    fireEvent.keyDown(input, {key: 'A', modifierCapsLock: true});
    expect(screen.getByText('Caps Lock is on')).toBeInTheDocument();
    fireEvent.keyUp(input, {key: 'a', modifierCapsLock: false});
    expect(screen.queryByText('Caps Lock is on')).not.toBeInTheDocument();
  });
});
