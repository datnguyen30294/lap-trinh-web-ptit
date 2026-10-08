import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import OriginAutocomplete from './OriginAutocomplete';
import { journeyPlannerApi } from '../../services/journeyPlannerApi';
import { searchAddresses } from '../../services/geocodingService';

vi.mock('../../services/journeyPlannerApi', () => ({
  journeyPlannerApi: { places: vi.fn() },
}));
vi.mock('../../services/geocodingService', () => ({
  searchAddresses: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  journeyPlannerApi.places.mockResolvedValue({ items: [] });
});
afterEach(() => vi.useRealTimers());
const props = {
  current: { position: null, status: 'idle' },
  onSelect: vi.fn(),
  onClear: vi.fn(),
  onLocate: vi.fn(),
};

it('debounces station lookup for 400ms and never geocodes while typing', async () => {
  vi.useFakeTimers();
  render(<OriginAutocomplete {...props} />);
  const input = screen.getByRole('combobox', { name: 'Điểm đi' });
  fireEvent.change(input, { target: { value: 'Hồ' } });
  await act(async () => vi.advanceTimersByTimeAsync(399));
  expect(journeyPlannerApi.places).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'Hồ Gươm' } });
  await act(async () => vi.advanceTimersByTimeAsync(399));
  expect(journeyPlannerApi.places).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(journeyPlannerApi.places).toHaveBeenCalledExactlyOnceWith(
    'Hồ Gươm',
    expect.any(AbortSignal),
  );
  expect(searchAddresses).not.toHaveBeenCalled();
});

it('shows geocoding failure without losing the typed address and allows retry', async () => {
  searchAddresses
    .mockRejectedValueOnce(new Error('Chưa tìm được địa chỉ'))
    .mockResolvedValueOnce([]);
  render(<OriginAutocomplete {...props} />);
  fireEvent.change(screen.getByRole('combobox'), {
    target: { value: 'Địa chỉ cần tìm' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Tìm địa chỉ tại Hà Nội' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Chưa tìm được địa chỉ',
  );
  expect(screen.getByRole('combobox')).toHaveValue('Địa chỉ cần tìm');
  fireEvent.click(
    screen.getByRole('button', { name: 'Tìm địa chỉ tại Hà Nội' }),
  );
  await screen.findByText(/Không tìm thấy địa chỉ trong vùng/);
  expect(
    screen.getByRole('option', { name: /Dùng vị trí hiện tại/ }),
  ).toBeInTheDocument();
});
