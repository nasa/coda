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
};
