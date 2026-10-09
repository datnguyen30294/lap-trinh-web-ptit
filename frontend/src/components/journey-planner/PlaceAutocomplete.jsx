import { useEffect, useId, useRef, useState } from 'react';
import { journeyPlannerApi } from '../../services/journeyPlannerApi';

export default function PlaceAutocomplete({
  selected,
  onSelect,
  onClear,
  initialQuery = '',
}) {
  const id = useId();
  const inputRef = useRef(null);
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({
    status: 'idle',
    items: [],
    total: 0,
    error: '',
  });
  const term = query.trim();

  useEffect(() => {
    if (!term || selected) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setResult({ status: 'loading', items: [], total: 0, error: '' });
      journeyPlannerApi
        .places(term, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted)
            setResult({
              status: 'success',
              items: data.items,
              total: data.total,
              error: '',
            });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setResult({
              status: 'error',
              items: [],
              total: 0,
              error: error.message,
            });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, term, selected, attempt]);

  const expanded = open && !selected && !!term;
  function choose(place) {
    onSelect(place);
    setQuery(place.name);
    setOpen(false);
    setActive(-1);
  }
  function change(value) {
    setQuery(value);
    onClear();
    setActive(-1);
    setOpen(true);
    setResult({
      status: value.trim() ? 'loading' : 'idle',
      items: [],
      total: 0,
      error: '',
    });
  }
  function keyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (expanded && active >= 0 && result.items[active])
        choose(result.items[active]);
    }
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      if (!result.items.length) return;
      setActive((index) =>
        event.key === 'ArrowDown'
          ? (index + 1) % result.items.length
          : index <= 0
            ? result.items.length - 1
            : index - 1,
      );
    }
  }

  return (
    <div
      className="jp-point-autocomplete"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setOpen(false);
      }}
    >
      <div className="jp-point">
        <span className="jp-marker jp-marker-destination" aria-hidden="true">
          B
        </span>
        <label htmlFor={id}>
          <span>Điểm đến</span>
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={`${id}-list`}
            aria-activedescendant={
              expanded && active >= 0 ? `${id}-option-${active}` : undefined
            }
            aria-describedby={`${id}-hint`}
            autoComplete="off"
            spellCheck={false}
            maxLength={255}
            placeholder="Nhập tên trạm hoặc địa chỉ…"
            title={selected?.address}
            value={selected?.name ?? query}
            onChange={(event) => change(event.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={keyDown}
          />
        </label>
        {(selected || query) && (
          <button
            type="button"
            className="jp-clear"
            aria-label="Xóa điểm đến"
            onClick={() => {
              change('');
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </div>
      <p className="jp-sr-only" id={`${id}-hint`}>
        Nhập tên, mã hoặc địa chỉ. Dùng phím lên xuống và Enter để chọn địa
        điểm.
      </p>
      {expanded && (
        <div className="jp-dropdown">
          {result.status === 'loading' && (
            <p className="jp-search-status" role="status">
              Đang tìm địa điểm…
            </p>
          )}
          {result.status === 'error' && (
            <div className="jp-search-status" role="alert">
              <p>{result.error}</p>
              <button
                type="button"
                className="jp-text-button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Thử lại tìm kiếm
              </button>
            </div>
          )}
          <ul id={`${id}-list`} role="listbox" aria-label="Địa điểm gợi ý">
            {result.items.map((place, index) => (
              <li
                key={place.id}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={active === index}
                className={active === index ? 'jp-option-active' : ''}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(place)}
              >
                <img src="/icons/mappin.svg" alt="" width="20" height="20" />
                <span>
                  <strong>{place.name}</strong>
                  <small>{place.address}</small>
                </span>
                <span className="jp-place-code">{place.code}</span>
              </li>
            ))}
          </ul>
          {result.status === 'success' && !result.items.length && (
            <p className="jp-search-status" role="status">
              Không tìm thấy địa điểm phù hợp. Hãy thử tên hoặc địa chỉ khác.
            </p>
          )}
          {result.status === 'success' &&
            result.total > result.items.length && (
              <p className="jp-search-status">
                Hiển thị {result.items.length}/{result.total} địa điểm. Nhập
                thêm để tìm chính xác hơn.
              </p>
            )}
        </div>
      )}
    </div>
  );
}
