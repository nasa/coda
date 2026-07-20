// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function encode_rd(r) {
  return encodeURIComponent(
    r.variables.scheme + "://" + r.variables.http_host + r.variables.request_uri
  );
}
export default { encode_rd };
