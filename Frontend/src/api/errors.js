export const getApiErrorMessage = (error, fallbackMessage) => {
  const responseMessage = error?.response?.data?.message;

  return typeof responseMessage === "string" && responseMessage.trim()
    ? responseMessage
    : fallbackMessage;
};
