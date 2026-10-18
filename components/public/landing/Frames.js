// Molduras das capturas reais do produto (Banda Aurora, dados fictícios de demonstração).

export function BrowserFrame({ src, alt, path = '', width = 1600, height = 1000, priority = false, className = '' }) {
  return (
    <figure className={`overflow-hidden rounded-[18px] border border-white/12 bg-slate-900 shadow-[0_40px_120px_rgba(2,6,23,0.6)] ${className}`}>
      <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900/95 px-4 py-2.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-3 hidden min-w-0 flex-1 truncate rounded-md bg-white/[0.06] px-3 py-1 text-[11px] font-medium text-slate-400 sm:block">
          app.bandaharmonics.com{path}
        </span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className="block h-auto w-full"
      />
    </figure>
  );
}

export function PhoneFrame({ src, alt, priority = false, className = '' }) {
  return (
    <figure className={`relative rounded-[2.4rem] border border-white/15 bg-slate-950 p-2 shadow-[0_40px_100px_rgba(2,6,23,0.65)] ${className}`}>
      <span className="absolute left-1/2 top-3.5 z-10 h-1.5 w-14 -translate-x-1/2 rounded-full bg-white/15" aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={600}
        height={1298}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className="block h-auto w-full rounded-[1.9rem]"
      />
    </figure>
  );
}
