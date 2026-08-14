function encode_rd(request) {
  return encodeURIComponent(
    request.variables.scheme + "://" + request.variables.http_host + request.variables.request_uri
  );
}

export default { encode_rd };
