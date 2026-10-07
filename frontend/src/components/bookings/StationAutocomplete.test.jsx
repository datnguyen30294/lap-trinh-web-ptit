import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StationAutocomplete from './StationAutocomplete';

const stations = [
  { id: '5', code: 'BX-YN', name: 'Bến xe Yên Nghĩa' },
  { id: '1', code: 'DH-PTIT', name: 'Học viện Công nghệ Bưu chính Viễn thông' },
  { id: '3', code: 'NTS', name: 'Ngã Tư Sở' },
];

function Field({ initialValue = '', onChange = () => {} }) {
  const [value, setValue] = useState(initialValue);
  return (
    <StationAutocomplete
      label="Điểm đi"
      stations={stations}
      value={value}
      onChange={(id) => {
        setValue(id);
        onChange(id);
      }}
    />
  );
}

describe('AC-1 station autocomplete', () => {
  it('matches names with or without Vietnamese accents, uppercase and station codes', async () => {
    const actor = userEvent.setup();
    render(<Field />);
    const input = screen.getByRole('combobox', { name: 'Điểm đi *' });
    await actor.type(input, 'YEN   nghia');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('Bến xe Yên Nghĩa');
    await actor.clear(input);
    await actor.type(input, 'Viễn Thông');
    expect(screen.getByRole('option')).toHaveTextContent('Học viện Công nghệ');
    await actor.clear(input);
    await actor.type(input, 'dh-ptit');
    expect(screen.getByRole('option')).toHaveTextContent('Học viện Công nghệ');
  });

  it('selects a real ID by click and reopens the suggestions when clicking the focused input', async () => {
    const actor = userEvent.setup();
    const changed = vi.fn();
    render(<Field onChange={changed} />);
    const input = screen.getByRole('combobox');
    await actor.type(input, 'yen');
    await actor.click(screen.getByRole('option'));
    expect(changed).toHaveBeenLastCalledWith('5');
    expect(input).toHaveValue('Bến xe Yên Nghĩa');
    expect(input).toBeValid();
    expect(input).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await actor.click(input);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(
      'Yên Nghĩa',
    );
  });

  it('supports arrows, Enter to choose, Escape and Tab to close', async () => {
    const actor = userEvent.setup();
    const changed = vi.fn();
    render(
      <>
        <Field onChange={changed} />
        <button>Tiếp theo</button>
      </>,
    );
    const input = screen.getByRole('combobox');
    await actor.click(input);
    await actor.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      screen.getAllByRole('option')[1].id,
    );
    await actor.keyboard('{Enter}');
    expect(changed).toHaveBeenLastCalledWith('1');
    expect(input).toHaveValue(stations[1].name);
    await actor.keyboard('{ArrowUp}{Enter}');
    expect(changed).toHaveBeenLastCalledWith('3');
    await actor.keyboard('{ArrowDown}{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await actor.keyboard('{ArrowDown}{Tab}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveFocus();
  });

  it('clears the previous ID when editing and rejects an unselected or empty station', async () => {
    const actor = userEvent.setup();
    const changed = vi.fn();
    render(<Field initialValue="5" onChange={changed} />);
    const input = screen.getByRole('combobox');
    await actor.clear(input);
    expect(changed).toHaveBeenLastCalledWith('');
    expect(input).toBeInvalid();
    await actor.type(input, 'dia diem khong ton tai');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Không tìm thấy địa điểm phù hợp',
    );
    expect(input.validationMessage).toContain('chọn một địa điểm');
    await actor.clear(input);
    await actor.type(input, 'yen nghia');
    expect(input).toBeInvalid();
    await actor.keyboard('{Enter}');
    expect(changed).toHaveBeenLastCalledWith('5');
    expect(input).toBeValid();
  });

  it('resolves a preset ID after API stations load without requesting a new selection', () => {
    const changed = vi.fn();
    const { rerender } = render(
      <StationAutocomplete
        label="Điểm đi"
        value="5"
        stations={[]}
        disabled
        onChange={changed}
      />,
    );
    const input = screen.getByRole('combobox');
    expect(input).toBeDisabled();
    rerender(
      <StationAutocomplete
        label="Điểm đi"
        value="5"
        stations={stations}
        onChange={changed}
      />,
    );
    expect(input).toHaveValue('Bến xe Yên Nghĩa');
    expect(input).toBeEnabled();
    expect(changed).not.toHaveBeenCalled();
  });
});
