import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ScanInput} from './ScanInput';

describe('ScanInput', () => {
  it('reads the code on Enter, clears itself and keeps the focus', async () => {
    const onScan = vi.fn();
    render(<ScanInput label="Barcode" onScan={onScan} size="lg" autoFocus />);

    const input = screen.getByLabelText('Barcode');
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAttribute('autocapitalize', 'off');
    expect(input).toHaveAttribute('enterkeyhint', 'done');
    await userEvent.type(input, ' KF-01 {Enter}');
    expect(onScan).toHaveBeenCalledWith('KF-01');
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    await userEvent.type(input, '{Enter}');
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it('counts a scanner burst ending in two Enters as one scan', () => {
    vi.useFakeTimers();
    const onScan = vi.fn();
    render(<ScanInput label="Barcode" onScan={onScan} />);
    const input = screen.getByLabelText('Barcode');

    fireEvent.change(input, {target: {value: 'KF-02'}});
    fireEvent.keyDown(input, {key: 'Enter'});
    fireEvent.change(input, {target: {value: 'KF-02'}});
    vi.advanceTimersByTime(20);
    fireEvent.keyDown(input, {key: 'Enter'});
    expect(onScan).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    fireEvent.keyDown(input, {key: 'Enter'});
    expect(onScan).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
