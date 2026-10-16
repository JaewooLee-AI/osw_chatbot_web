/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'kkdnirublmowoujklhus.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/widget/:path*',
        headers: [
          // 고객사 홈페이지가 iframe으로 위젯을 띄울 수 있게 허용한다. X-Frame-Options에는 '모두 허용' 값이 없어
          // (ALLOWALL은 표준이 아니라 무시된다) 쓰지 않고, CSP frame-ancestors로만 정한다.
          { key: 'Content-Security-Policy', value: 'frame-ancestors *;' },
        ],
      },
      {
        source: '/embed.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=300' },
        ],
      },
    ];
  },
};

export default nextConfig;
