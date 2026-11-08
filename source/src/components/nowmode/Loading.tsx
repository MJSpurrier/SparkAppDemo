export function Loading() {
  return (
    <div className="grid h-full place-items-center" aria-busy="true">
      <span className="size-3 animate-breathe rounded-full bg-blue" />
    </div>
  );
}