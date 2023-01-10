export function pulseTrack(Pulse) {
  if (typeof Pulse !== "undefined") {
    try {
      Pulse.track("CODA", { auid: "" }); //coda doesn't have auth to track username
    } catch (e) {
      console.log("Pulse tracking failed " + e);
      var Pulse = (function () {
        var module = {};
        module.track = function () {};
        module.logInfo = function () {};
        module.logWarn = function () {};
        module.logError = function () {};
        module.event = function () {};
        return module;
      })();
    }
  } else {
    console.log("Pulse Tracking - undefined");
  }
}

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
