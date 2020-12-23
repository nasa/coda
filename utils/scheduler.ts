import { store } from "store";
import { currentClockSelector, currentGMT } from "store/clock";

let interval;
function checkForVideoChange() {
  if (!interval) {
    interval = setInterval(() => {
      const GMT = currentGMT();
      console.log(GMT);
    }, 1000);
  }
}

// the server shouldn't be running clocks!!!
if (typeof window !== "undefined") {
  const unsubscribe = store.subscribe(checkForVideoChange);
}
