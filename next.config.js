/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: "standalone",
  eslint: {
    dirs: ["."],
  },
  optimizeFonts: false,
  swcMinify: true,
};

module.exports = nextConfig;
