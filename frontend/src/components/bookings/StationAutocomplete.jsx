import { useEffect, useId, useRef, useState } from 'react';

// Cho phép tìm "yen nghia" hoặc "đầu" mà không cần gõ đúng dấu.
const normalize = (text) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();

export default function StationAutocomplete({
  label,
  stations,
  value,
  onChange,
  disabled,
  initialQuery = '',
  onQueryChange,
  allowFreeText = false,
  placeholder,
  icon,
  className = '',
}) {
  const id = useId();
  const inputRef = useRef(null);
  const optionRefs = useRef([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [editing, setEditing] = useState(!!initialQuery && !value);
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = stations.find((station) => station.id === value);
  const words = normalize(editing ? query : '')
    .split(/\s+/)
    .filter(Boolean);
  const results = stations.filter((station) => {
    const text = normalize(`${station.name} ${station.code || ''}`);
    return words.every((word) => text.includes(word));
  });
  const expanded = open && !disabled;

  useEffect(() => {
    inputRef.current?.setCustomValidity(
      !allowFreeText && !disabled && editing && query && !selected
        ? 'Vui lòng chọn một địa điểm trong danh sách gợi ý.'
        : '',
    );
  }, [allowFreeText, disabled, editing, query, selected]);
  useEffect(() => {
    if (expanded)
      optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, expanded]);

  function choose(station) {
    onChange(station.id);
    onQueryChange?.(station.name);
    setEditing(false);
    setQuery('');
    setOpen(false);
  }
  function keyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) =>
        !expanded
          ? direction === 1
            ? 0
            : Math.max(0, results.length - 1)
          : (index + direction + results.length) %
            Math.max(1, results.length),
      );
    } else if (event.key === 'Enter' && expanded && results[activeIndex]) {
      event.preventDefault();
      if (results[activeIndex]) choose(results[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }
  return (
    <div className={`booking-field booking-station-field ${className}`}>
      <label htmlFor={id}>
        {label}
        {!allowFreeText && ' *'}
      </label>
      <div className="booking-station-input">
        <input
          id={id}
          ref={inputRef}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={`${id}-options`}
          aria-activedescendant={
            expanded && results[activeIndex]
              ? `${id}-option-${results[activeIndex].id}`
              : undefined
          }
          autoComplete="off"
          required={!allowFreeText}
          maxLength={255}
          disabled={disabled}
          placeholder={
            placeholder || `Gõ tên hoặc chọn ${label.toLowerCase()}`
          }
          value={editing ? query : selected?.name || ''}
          onFocus={() => {
            setOpen(true);
            setActiveIndex(0);
          }}
          onClick={() => {
            setOpen(true);
            setActiveIndex(0);
          }}
          onBlur={(event) => {
            // Home suggestions take layout space. Keep action buttons still
            // between pointerdown (focus transfer) and click.
            if (allowFreeText && event.relatedTarget?.closest('button, a'))
              return;
            setOpen(false);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            onQueryChange?.(event.target.value);
            setEditing(true);
            setOpen(true);
            setActiveIndex(0);
            // Chữ đang gõ chưa phải một bến đã được chọn.
            if (value) onChange('');
          }}
          onKeyDown={keyDown}
        />
        {icon ? (
          <img className="booking-station-icon" src={icon} alt="" />
        ) : (
          <svg
            className="booking-station-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 5 5" />
          </svg>
        )}
      </div>
      {expanded && (
        <div className="booking-station-menu">
          <ul
            id={`${id}-options`}
            role="listbox"
            aria-label={`Gợi ý ${label.toLowerCase()}`}
          >
            {results.map((station, index) => (
              <li
                key={station.id}
                id={`${id}-option-${station.id}`}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                role="option"
                aria-selected={station.id === value}
                className={index === activeIndex ? 'active' : ''}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(station)}
              >
                <span>{station.name}</span>
                {station.code && <small>Mã bến: {station.code}</small>}
              </li>
            ))}
          </ul>
          {!results.length && (
            <p role="status">
              Không tìm thấy địa điểm phù hợp. Bạn thử tên khác nhé.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
