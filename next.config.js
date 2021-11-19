module.exports = {
  async redirects() {
    return [
      {
        source: "/view",
        destination: "/view/iss",
        permanent: true,
      },
    ];
  },
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 2500 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 20,
  },
};
