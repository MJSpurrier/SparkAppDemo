/** Now Mode mark: a calm ring with a single "now" dot. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-2xl bg-card2 ring-1 ring-border2"
      style={{ width: size, height: size }}
      aria-label="Now Mode"
      role="img"
    >
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none">
        <circle cx="12" cy="12" r="9" strokeWidth="2.4" className="stroke-border2" />
        <circle
          cx="12"
          cy="12"
          r="9"
          strokeWidth="2.4"
          className="stroke-blue"
          strokeDasharray="40 100"
          strokeLinecap="round"
          transform="rotate(-90 12 12)"
        />
        <circle cx="12" cy="12" r="3" className="fill-teal" />
      </svg>
    </div>
  );
}