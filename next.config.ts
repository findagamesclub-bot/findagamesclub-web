import type { NextConfig } from "next";

/**
 * Discussion photos live in Supabase Storage, whose host differs per
 * environment, so the pattern is read from the same variable the URLs are
 * built from rather than hardcoded.
 */
const storageHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: storageHost
      ? [{ protocol: "https" as const, hostname: storageHost,
           pathname: "/storage/v1/object/public/**" }]
      : [],
  },

  /**
   * Messages moved inside the account shell, and tickets with it. These are
   * config redirects rather than pages that call `redirect()`: a page has to
   * render before it can redirect, which on a client-side navigation shows a
   * blank screen with no sidebar for a moment before the real one arrives.
   * The routing layer has no such gap.
   *
   * Both addresses are in sent emails, so they are permanent.
   */
  async redirects() {
    return [
      { source: "/messages", destination: "/account/messages", permanent: true },
      {
        source: "/messages/:clubId/:personId",
        destination: "/account/messages/:clubId/:personId",
        permanent: true,
      },
      { source: "/tickets", destination: "/account/tickets", permanent: true },
    ];
  },
};

export default nextConfig;
