const fetchWithAuth = (...args) => fetch(...args);

const fetchJsonWithAuth = async (input, init) => {
  try {
    const response = await fetch(input, init);
    if (!response.ok) return new Error(`Request failed with status ${response.status}`);
    return await response.json();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
};

export const createFetchWithAuthFunctions = () => ({ fetchWithAuth, fetchJsonWithAuth });
export const webAuthPopup = async () => {};