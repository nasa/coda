export function pulseEvent(event) {
  if (typeof Pulse !== "undefined") {
    try {
      Pulse.event(event);
    } catch (e) {
      console.log("Pulse event failed " + event + " - " + e);
    }
  } else {
    console.log("Pulse Event - undefined");
  }
}

export function pulseLogInfo(message) {
  if (typeof Pulse !== "undefined") {
    try {
      Pulse.logInfo(message);
    } catch (e) {
      console.log("Pulse log info failed " + message + " - " + e);
    }
  } else {
    console.log("Pulse Log Info - undefined");
  }
}
