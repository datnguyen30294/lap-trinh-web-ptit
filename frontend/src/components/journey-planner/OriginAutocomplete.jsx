import { useEffect, useId, useRef, useState } from 'react';
import { journeyPlannerApi } from '../../services/journeyPlannerApi';
import { searchAddresses } from '../../services/geocodingService';
import './origin-autocomplete.css';

export default function OriginAutocomplete({
  current,
  onSelect,
  onClear,
  onLocate,
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState({
    items: [],
    error: '',
    loading: false,
  });
  const [addresses, setAddresses] = useState({
    items: [],
    status: 'idle',
    error: '',
  });
  const addressRequest = useRef(null);
  const selected = current.position;
  const term = query.trim();
  useEffect(() => () => addressRequest.current?.abort(), []);

  useEffect(() => {
    if (!term || selected) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await journeyPlannerApi.places(term, controller.signal);
        if (!controller.signal.aborted) {
          setActive(-1);
          setResult({ items: data.items, error: '', loading: false });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setActive(-1);
          setResult({ items: [], error: error.message, loading: false });
        }
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, term, selected]);

  const items = selected ? [] : [...result.items, ...addresses.items];
  async function findAddress() {
    if (term.length < 2 || selected || addresses.status === 'loading') return;
    addressRequest.current?.abort();
    const controller = new AbortController();
    addressRequest.current = controller;
    setActive(-1);
    setAddresses({ items: [], status: 'loading', error: '' });
    try {
      const items = await searchAddresses(term, controller.signal);
      if (!controller.signal.aborted) {
        setActive(-1);
        setAddresses({ items, status: 'success', error: '' });
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setAddresses({ items: [], status: 'error', error: error.message });
    }
  }
  function choose(index) {
    if (index !== 0 && !items[index - 1]) return;
    addressRequest.current?.abort();
    setAddresses({ items: [], status: 'idle', error: '' });
    setResult({ items: [], error: '', loading: false });
    setOpen(false);
    setActive(-1);
    setQuery('');
    if (index === 0) onLocate(true);
    else onSelect(items[index - 1]);
  }
  function change(value) {
    addressRequest.current?.abort();
    setAddresses({ items: [], status: 'idle', error: '' });
    setQuery(value);
    onClear();
    setOpen(true);
    setActive(-1);
    setResult({ items: [], error: '', loading: !!value.trim() });
  }
  function beginEditing() {
    const isCurrentLocation =
      selected &&
      (selected.isDemo ||
        !selected.label ||
        selected.label === 'Vị trí của bạn' ||
        selected.label === 'Vị trí hiện tại của bạn');
    if (isCurrentLocation) change('');
    else setOpen(true);
  }
  function keyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive((index) =>
        event.key === 'ArrowDown'
          ? (index + 1) % (items.length + 1)
          : index <= 0
            ? items.length
            : index - 1,
      );
    }
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (open && active >= 0) choose(active);
      else {
        setOpen(true);
        findAddress();
      }
    }
  }

  return (
    <div
      className="jp-point-autocomplete"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="jp-point">
        <span className="jp-marker" aria-hidden="true">
          A
        </span>
        <label htmlFor={id}>
          <span>Điểm đi</span>
          <input
            id={id}
            aria-label="Điểm đi"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-activedescendant={
              open && active >= 0 ? `${id}-${active}` : undefined
            }
            value={
              selected ? selected.label || 'Vị trí hiện tại của bạn' : query
            }
            placeholder={
              current.status === 'loading'
                ? 'Đang xác định vị trí…'
                : 'Nhập địa chỉ hoặc trạm xe…'
            }
            maxLength={255}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => change(event.target.value)}
            onFocus={beginEditing}
            onClick={beginEditing}
            onKeyDown={keyDown}
          />
        </label>
      </div>
      {open && (
        <div className="jp-dropdown jp-origin-dropdown">
          <ul id={`${id}-list`} role="listbox" aria-label="Gợi ý điểm đi">
            {[null, ...items].map((item, index) => (
              <li
                key={item?.id || `address-${index}`}
                id={`${id}-${index}`}
                role="option"
                aria-selected={active === index}
                className={active === index ? 'jp-option-active' : ''}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                {!item && (
                  <img src="/icons/mappin.svg" alt="" width="18" height="18" />
                )}
                <span>
                  <strong>
                    {item?.name || 'Dùng vị trí hiện tại của tôi'}
                  </strong>
                  {item && (
                    <small>{item.address || 'Địa chỉ OpenStreetMap'}</small>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {!selected && result.loading && (
            <p className="jp-search-status" role="status">
              Đang tìm điểm đi…
            </p>
          )}
          {!selected && result.error && (
            <p className="jp-search-status" role="alert">
              {result.error}
            </p>
          )}
          {!selected &&
            term &&
            !result.loading &&
            !result.error &&
            !result.items.length && (
              <p className="jp-search-status" role="status">
                Không tìm thấy trạm phù hợp.
              </p>
            )}
          {!selected && (
            <div className="jp-origin-address-search">
              <button
                type="button"
                className="jp-location-button"
                onClick={findAddress}
                disabled={term.length < 2 || addresses.status === 'loading'}
              >
                {addresses.status === 'loading'
                  ? 'Đang tìm địa chỉ…'
                  : 'Tìm địa chỉ tại Hà Nội'}
              </button>
              {addresses.error && (
                <p className="jp-error" role="alert">
                  {addresses.error}
                </p>
              )}
              {addresses.status === 'success' && !addresses.items.length && (
                <p className="jp-hint" role="status">
                  Không tìm thấy địa chỉ trong vùng tìm kiếm Hà Nội. Hãy thử tên
                  địa danh hoặc đường phố.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
