/** @type {import('next').NextConfig} */
const noStoreHeaders = [
  {
    key: 'Cache-Control',
    value: 'no-store, max-age=0, must-revalidate',
  },
];

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async headers() {
    return [
      { source: '/', headers: noStoreHeaders },
      { source: '/before', headers: noStoreHeaders },
      { source: '/after', headers: noStoreHeaders },
      { source: '/after/result', headers: noStoreHeaders },
      { source: '/after/intake', headers: noStoreHeaders },
      { source: '/after/draft', headers: noStoreHeaders },
      { source: '/history', headers: noStoreHeaders },
    ];
  },
};

export default nextConfig;
