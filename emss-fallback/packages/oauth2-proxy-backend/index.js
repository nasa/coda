export const getUserFromJWT = () =>
  new Error("JWT authentication is unavailable in public mode. Set MOCK_USER=true.");

export const handleUnableToDecodeJWT = (error, response) => {
  response.status(401).json({ status: "error", message: error.message });
};