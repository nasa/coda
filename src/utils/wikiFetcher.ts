import makeFetchCookie from "fetch-cookie";

const fetchCookie = makeFetchCookie(fetch);

interface LoginResponse {
  clientlogin?: {
    status: string;
    message?: string;
  };
  error?: {
    code: string;
    info: string;
  };
}

interface TokenResponse {
  query?: {
    tokens?: {
      logintoken?: string;
      csrftoken?: string;
    };
  };
}

async function getLoginToken(apiUrl: string): Promise<string> {
  const tokenResponse = await fetchCookie(
    `${apiUrl}?action=query&meta=tokens&type=login&format=json`,
    {
      method: "GET",
    }
  );
  const tokenData: TokenResponse = await tokenResponse.json();

  return tokenData?.query?.tokens?.logintoken || "";
}

async function performLogin(apiUrl: string, username: string, password: string): Promise<void> {
  let loginToken;
  try {
    loginToken = await getLoginToken(apiUrl);
  } catch (e) {
    console.error(e);
    throw new Error("Failed to retrieve login token.");
  }

  const loginParams = new URLSearchParams({
    action: "login",
    lgname: username,
    lgpassword: password,
    lgdomain: process.env.HOST,
    lgtoken: loginToken,
    format: "json",
  });

  const body = loginParams.toString();

  const loginResponse = await fetchCookie(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const loginData: LoginResponse = await loginResponse.json();

  if (loginData.clientlogin?.status !== "PASS") {
    console.error(`Login failed: ${JSON.stringify(loginData)}`);
    throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  }

  console.log("Login successful.");
}

export async function nasaWikiFetch({
  wikiName,
  queryParams,
}: {
  wikiName: "iss" | "exploration";
  queryParams: string;
}): Promise<any> {
  const apiUrl = `${process.env.WIKI_BASE_URL}/${wikiName}/api.php`;
  const username = process.env.WIKI_USER;
  const password = process.env.WIKI_PASSWORD;

  // Login first without retries
  await performLogin(apiUrl, username, password);

  const fullUrl = `${apiUrl}?action=cargoquery&${queryParams}&format=json`;
  const infoResponse = await fetchCookie(fullUrl, { method: "GET" });
  const infoJson = await infoResponse.json();
  return infoJson;
}
