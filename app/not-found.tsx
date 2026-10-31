import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-950 text-white text-center">
      <div className="max-w-md space-y-4">
        <span className="text-xs uppercase tracking-widest text-zinc-500 font-mono">404 Error</span>
        <h1 className="text-3xl font-bold">Brand or Page Not Found</h1>
        <p className="text-sm text-zinc-400">
          The brand storefront or product you are looking for does not exist or has been moved.
        </p>
        <div className="pt-4 flex flex-col gap-2 sm:flex-row justify-center">
          <Link
            href="/urban-streetwear"
            className="px-5 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors"
          >
            Urban Streetwear
          </Link>
          <Link
            href="/linen-and-co"
            className="px-5 py-2.5 rounded-lg bg-stone-700 text-white text-sm font-semibold hover:bg-stone-600 transition-colors"
          >
            Linen & Co.
          </Link>
        </div>
      </div>
    </div>
  );
}
