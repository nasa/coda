const noop = () => Promise.resolve();

export const createServerLogger = () => ({
  emergency: noop,
  alert: noop,
  critical: noop,
  error: noop,
  warning: noop,
  notice: noop,
  info: noop,
  debug: noop,
  forwardFromClient: noop,
  logUserLogin: noop,
});

export const sendClientLogsToLogstash = ({ response, res }) =>
  (response ?? res).status(200).json({ status: "ok" });