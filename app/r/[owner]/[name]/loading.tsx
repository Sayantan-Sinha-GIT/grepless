import { LogoMark } from '@/components/chrome/Logo';

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-32 sm:px-6" aria-busy="true" aria-label="Loading repository">
      <div className="skeleton h-4 w-40 rounded-full" />
      <div className="mt-8 flex items-center gap-5">
        <div className="skeleton h-16 w-16 rounded-[1.4rem]" />
        <div className="flex-1 space-y-3">
          <div className="skeleton h-3 w-24 rounded-full" />
          <div className="skeleton h-14 w-2/3 max-w-md rounded-2xl" />
        </div>
      </div>
      <div className="mt-12 flex items-center justify-center py-16">
        <span className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 rounded-3xl bg-brand/40" style={{ animation: 'pulse-ring 1.4s ease-out infinite' }} />
          <LogoMark size={56} className="relative" />
        </span>
      </div>
    </div>
  );
}
