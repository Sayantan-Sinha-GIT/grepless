// Fixed backdrop shared by every page: slow drifting colour fields, a masked
// dot grid and film grain. Pure CSS, so it costs nothing on the main thread.
export function Background() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -left-[15vw] -top-[20vh] h-[70vh] w-[70vw] rounded-full opacity-60 blur-[110px]"
        style={{ background: 'var(--blob-a)', animation: 'drift-a 26s ease-in-out infinite' }}
      />
      <div
        className="absolute -right-[20vw] top-[10vh] h-[60vh] w-[55vw] rounded-full opacity-40 blur-[120px]"
        style={{ background: 'var(--blob-c)', animation: 'drift-b 32s ease-in-out infinite' }}
      />
      <div
        className="absolute bottom-[-25vh] left-[20vw] h-[55vh] w-[60vw] rounded-full opacity-45 blur-[120px]"
        style={{ background: 'var(--blob-b)', animation: 'drift-c 38s ease-in-out infinite' }}
      />
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage: 'radial-gradient(var(--line-strong) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 20%, transparent 75%)',
        }}
      />
      <div className="grain" />
    </div>
  );
}
