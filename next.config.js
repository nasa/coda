/** @type {import('next').NextConfig} */
const nextConfig = {
  // async redirects() {
  //   return [
  //     {
  //       source: "/view",
  //       destination: "/view/iss",
  //       permanent: true,
  //     },
  //   ];
  // },
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 2500 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 20,
  },

  // this allows hot-refresh to work in Docker on Windows until this WSL issue is resolved:
  // https://github.com/microsoft/WSL/issues/4739
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
      ignored: /\.cache|\.cookies|\.local|\.next|\.vscode|ci|coverage|docker|docs|node_modules/,
    };
    return config;
  },

  env: {
    USERNAME: process.env.USERNAME,
  },
};

module.exports = nextConfig;
