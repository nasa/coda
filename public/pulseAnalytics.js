export function pulseTrack(auid, Pulse) {
  if (typeof Pulse !== "undefined") {
    try {
      Pulse.track("CODA", { auid: auid });
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
