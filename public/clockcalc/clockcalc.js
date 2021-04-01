function runCalc() {
  const qrDate = new Date(document.getElementById("qrdate").value + "Z");
  const seconds = document.getElementById("seconds").value;
  const qrVidStartDate = new Date(document.getElementById("qrvidstartdate").value + "Z");
  const otherStartDate = new Date(document.getElementById("otherstartdate").value + "Z");

  const calcQrVidStartDate = new Date(qrDate - seconds * 1000);
  document.getElementById("qrcalcstart").innerHTML = calcQrVidStartDate.toISOString();

  const offset = calcQrVidStartDate - qrVidStartDate;
  document.getElementById("offset").innerHTML = offset;

  const calcOtherStartDate = new Date(otherStartDate.getTime() + offset);
  document.getElementById("othercalcstart").innerHTML = calcOtherStartDate.toISOString();
}
