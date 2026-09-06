import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#07070b] px-4 text-center text-zinc-200">
      <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">404</h1>
      <p className="mt-4 text-base text-zinc-400">Page not found</p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
      >
        Return to Journal
      </Link>
    </div>
  );
}
