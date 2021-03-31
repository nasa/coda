import Document, { Html, Head, Main, NextScript } from "next/document";

class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <meta charSet="utf-8" />
          <link
            rel="apple-touch-icon"
            sizes="180x180"
            href="/coda_node/favicon/apple-touch-icon.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="32x32"
            href="/coda_node/favicon/favicon-32x32.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="16x16"
            href="/coda_node/favicon/favicon-16x16.png"
          />
          <link rel="manifest" href="/coda_node/favicon/site.webmanifest" />
          <link rel="mask-icon" href="/coda_node/favicon/safari-pinned-tab.svg" color="#5bbad5" />
          <link href="/coda_node/mapbox_custom.css" rel="stylesheet" />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700&display=swap"
            rel="stylesheet"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Ubuntu+Mono&display=swap"
            rel="stylesheet"
          />
          <link href="https://api.mapbox.com/mapbox-gl-js/v2.1.1/mapbox-gl.css" rel="stylesheet" />
          <link href="/coda_node/global.css" rel="stylesheet" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
