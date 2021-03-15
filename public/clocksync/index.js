document.addEventListener("DOMContentLoaded", function () {
  var t;

  waitForTopOfSecond();

  function waitForTopOfSecond() {
    //start timer at the top of the next second
    var keepLooking = true;
    var i = 0;
    while (keepLooking) {
      var currUTCDate = new Date().toISOString();
      var milliseconds = currUTCDate.substring(20, 23);
      if (milliseconds === "000") {
        console.log(currUTCDate);
        keepLooking = false;
        t = setInterval(makeQR, 1000);
      }
    }
  }

  function makeQR() {
    currTimestamp = new Date();
    var currUTCDate = currTimestamp.toISOString();
    outputStr = currUTCDate;

    var typeNumber = 0;
    var errorCorrectionLevel = "H";
    var qr = qrcode(typeNumber, errorCorrectionLevel);
    qr.addData(outputStr, "Byte");
    qr.make();
    document.getElementById("qrcode").innerHTML = qr.createSvgTag({
      cellSize: 1,
      margin: 1,
      scalable: true,
    });

    document.getElementById("headerCenter").innerHTML = outputStr;

    var milliseconds = currUTCDate.substring(20, 23);
    if (parseInt(milliseconds) > 100) {
      clearInterval(t);
      waitForTopOfSecond();
    }
  }
});
