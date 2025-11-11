/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // endast widget-läget behöver få bäddas in
        source: "/:path*",
        headers: [
          // OBS: låt * bara vara under test. I produktion: lista dina tillåtna domäner.
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' *" },
          // vissa gamla proxies tittar på X-Frame-Options – ALLOWALL funkar brett
          { key: "X-Frame-Options", value: "ALLOWALL" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
