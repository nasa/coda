try {
  Pulse.track("CODA", { auid: "" });
} catch (e) {
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
