function StepIcon({ kind }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      {kind === 'walk' ? (
        <>
          <circle cx="14" cy="4" r="2" />
          <path d="m7 21 4-7m5 7-2-6-4-3 2-5 4 4h4M5 12l3-4 4-1" />
        </>
      ) : kind === 'bus' ? (
        <>
          <rect x="5" y="3" width="14" height="16" rx="3" />
          <path d="M5 11h14M8 19v3m8-3v3M8 15h1m6 0h1M9 6h6" />
        </>
      ) : (
        <>
          <path d="M12 22s8-9 8-14a8 8 0 0 0-16 0c0 5 8 14 8 14Z" />
          <circle cx="12" cy="8" r="2.5" />
        </>
      )}
    </svg>
  );
}

export default function JourneyTimeline({ steps, activeIndex }) {
  return (
    <ol className="jp-timeline" aria-label="Các bước di chuyển">
      {steps.map((step, index) => (
        <li
          key={index}
          aria-current={activeIndex === index ? 'step' : undefined}
        >
          <StepIcon kind={step.kind} />
          <div>
            <strong>{step.title}</strong>
            <p>{step.description}</p>
            {step.address && <p>{step.address}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
