import type { ReactNode } from 'react';

/** Infinite horizontal ticker. Content is duplicated so the loop is seamless. */
export function Marquee({
  children,
  duration = 40,
  reverse = false,
  className = '',
}: {
  children: ReactNode;
  duration?: number;
  reverse?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`marquee flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] ${className}`}
    >
      <div
        className="marquee-track flex w-max shrink-0 items-center"
        style={{
          ['--marquee-duration' as string]: `${duration}s`,
          animationDirection: reverse ? 'reverse' : 'normal',
        }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
