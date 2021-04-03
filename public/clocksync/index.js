document.addEventListener("DOMContentLoaded", function () {
  let clientTime = null;
  let serverTime = null;

  (async () => {
    const t = setInterval(waitForTopOfSecond, 1000);
  })();

  async function compareServerTime() {
    clientTime = new Date();
    const resource = "https://apolloinrealtime.org/coda_clocksync/server/gettime.php";
    const response = await fetch(resource);
    const serverTimeObj = await response.json();
    serverTime = new Date(serverTimeObj.serverTime);
    document.getElementById("timeComparisonValue").innerHTML =
      clientTime.getTime() - serverTime.getTime();
  }

  function waitForTopOfSecond() {
    const lastSeconds = new Date().toISOString().substring(17, 19);
    // loop until the second rolls over and then display the QR code
    while (true) {
      const currUTCDate = new Date().toISOString();
      const seconds = currUTCDate.substring(17, 19);
      if (seconds !== lastSeconds) {
        makeQR(currUTCDate);
        if (seconds % 5 === 0) {
          compareServerTime();
        }
        break;
      }
    }
  }

  function makeQR(currUTCDate) {
    const typeNumber = 0;
    const errorCorrectionLevel = "H";
    const qr = qrcode(typeNumber, errorCorrectionLevel);
    qr.addData(currUTCDate, "Byte");
    qr.make();
    document.getElementById("qrcode").innerHTML = qr.createSvgTag({
      cellSize: 1,
      margin: 5,
      scalable: true,
    });
    document.getElementById("headerCenter").innerHTML = currUTCDate;
  }
});
