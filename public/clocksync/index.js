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
      if (parseInt(milliseconds) < 10) {
        console.log(currUTCDate);
        keepLooking = false;
        makeQR();
        t = setInterval(makeQR, 100000);
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
      margin: 5,
      scalable: true,
    });
    // const cellSize = 10;
    // document.getElementById("qrcode").innerHTML = qr.createImgTag(cellSize, cellSize * 4);

    document.getElementById("headerCenter").innerHTML = outputStr;

    var milliseconds = currUTCDate.substring(20, 23);
    if (parseInt(milliseconds) > 500) {
      clearInterval(t);
      waitForTopOfSecond();
    }
  }
});
