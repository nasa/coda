// export function ajaxWikiGetAsExecuted(evaName, evNum) {
//   var url = './pullwiki.php?action=getAsExecuted&evaName=' + evaName + '&EVNum=' + evNum;
//   if (location.hostname === 'localhost') {
//       url = 'https://coda-dev.fit.nasa.gov/CODA_ISS/pullwiki.php?action=getAsExecuted&evaName=' + evaName + '&EVNum=' + evNum;
//   } else if (location.hostname === 'coda-iss.develop') { // use fake data if on dev
//       url = 'fakedata/getAsExecutedUS_EVA_55EV' + evNum + '.json';
//   }
//   $.ajaxSetup({
//       scriptCharset: "utf-8",
//       contentType: "application/json; charset=utf-8"
//   });
//   return $.getJSON(
//       url,
//       function (resp) {
//           var dateArr = gEVADetails.evaDate.split(/-/).map(Number);
//           var timeArr = gEVADetails.startTime.split(/:/).map(Number);
//           var ActivityStartUTCMilliseconds = Date.UTC(
//               dateArr[0], dateArr[1] - 1, dateArr[2], timeArr[0], timeArr[1], "00"
//           );
//           var activityArray = [];
//           var thisStartTimeSeconds = (ActivityStartUTCMilliseconds - gTimingData.video_earliestStart.getTime()) / 1000;

//           var resultObject = resp['query']['results'];
//           for (var key in resultObject) {
//               if (resultObject.hasOwnProperty(key)) {
//                   var durationHour = parseInt(resultObject[key]['printouts']['Duration hour'][0]);
//                   var durationMinute = parseInt(resultObject[key]['printouts']['Duration minute'][0]);
//                   var durationTotalSeconds = ((durationHour * 60) + durationMinute) * 60;

//                   var activityObject = {
//                       content: resultObject[key]['printouts']['Has text title'][0],
//                       startTimeSeconds: thisStartTimeSeconds,
//                       endTimeSeconds: thisStartTimeSeconds + durationTotalSeconds,
//                       color: resultObject[key]['printouts']['Color'][0]
//                   };
//                   if (activityObject.color === 'gray')
//                       activityObject.color = 'grey';

//                   thisStartTimeSeconds = thisStartTimeSeconds + durationTotalSeconds;
//                   activityArray.push(activityObject);
//               }
//           }
//           gVideoActivity['EV' + evNum] = activityArray;

//           console.log('ajaxWikiGetAsExecuted completed for EV' + evNum);
//       }).catch(function (jqXHR, textStatus, errorThrown) {
//       console.error(jqXHR);
//       console.error(textStatus);
//       console.error(errorThrown);
//   });
// }

// function ajaxGetDayNightJSON() {
//   return $.getJSON(
//       'fakedata/daynight.json',
//       {},
//       function (resp) {
//           // gVideoActivity.DayNight = createActivityArrayFromJSON(resp); //TODO make this use live wiki data
//           console.log('ajaxGetDayNightJSON completed.');
//       });
// }

// // function createActivityArrayFromJSON(resp) {
// //     var dateArr = resp.startGMT.split(/-| |:/).map(Number);
// //     var ActivityStartUTCMilliseconds = Date.UTC(
// //         dateArr[0], dateArr[1] - 1, dateArr[2], dateArr[3], dateArr[4], dateArr[5]
// //     );
// //     var activityArray = [];
// //     var activityStartTimeSeconds = (ActivityStartUTCMilliseconds - gTimingData.video_earliestStart.getTime()) / 1000;
// //     var thisStartTimeSeconds = activityStartTimeSeconds;
// //     for (var i=0; i < resp.events.length; i++) {
// //         var activityObject = {
// //             content: resp.events[i].content,
// //             startTimeSeconds: thisStartTimeSeconds,
// //             endTimeSeconds: thisStartTimeSeconds + (resp.events[i]['duration_min'] * 60)
// //         };
// //         thisStartTimeSeconds = thisStartTimeSeconds + (resp.events[i]['duration_min'] * 60);
// //         activityArray.push(activityObject);
// //     }
// //     return activityArray
// // }

// function ajaxGetAudioMetadataJSON() {
//   $.ajaxSetup({
//       scriptCharset: "utf-8",
//       contentType: "application/json; charset=utf-8"
//   });
//   var url = '/CODA_data/US_EVA_55/audio/US_EVA_55_audio_metadata.json';
//   if (location.hostname === 'localhost') {
//       url = 'https://coda-dev.fit.nasa.gov' + url;
//   }
//   return $.getJSON(
//       url,
//       {},
//       function (resp) {
//           gAudioMetadata = resp;

//           for (var i = 0; i < gAudioMetadata.length; i++) {
//               gAudioMetadata[i].startTimeSeconds = (new Date(gAudioMetadata[i].start_time) - gTimingData.video_earliestStart) / 1000;
//               gAudioMetadata[i].endTimeSeconds = (new Date(gAudioMetadata[i].end_time) - gTimingData.video_earliestStart) / 1000;
//           }
//           console.log('ajaxGetAudioMetadataJSON completed.');
//       }).catch(function (jqXHR, textStatus, errorThrown) {
//       console.error(jqXHR);
//       console.error(textStatus);
//       console.error(errorThrown);
//   });
// }

// export function ajaxWikiGetEVAs() {
//   var url = './pullwiki.php?action=getEVAs';
//   if (location.hostname === 'localhost') {
//       url = 'https://coda-dev.fit.nasa.gov/CODA_ISS/pullwiki.php?action=getEVAs';
//   } else if (
//       location.hostname === 'coda-iss.develop' ||
//       location.hostname === "localhost"
//   ) {
//       // use fake data if on dev
//       url = 'fakedata/getEVAs.json';
//   }
//   $.ajaxSetup({
//       scriptCharset: "utf-8",
//       contentType: "application/json; charset=utf-8"
//   });
//   return $.getJSON(
//       url,
//       function (resp) {
//           var dropdown = $('#EVAsDropdown');
//           dropdown.empty();
//           dropdown.append('<option selected="true" disabled>Choose EVA</option>');
//           dropdown.prop('selectedIndex', 0);

//           var resultObject = resp['query']['results'];
//           for (var evaName in resultObject) {
//               dropdown.append($('<option></option>').attr('value', evaName).text(evaName + ' - ' + resultObject[evaName]['printouts']['EVA title']));
//           }

//           console.log('ajaxWikiGetEVAs completed.');
//       }).catch(function (jqXHR, textStatus, errorThrown) {
//       console.error(jqXHR);
//       console.error(textStatus);
//       console.error(errorThrown);
//   });
// }

// export function ajaxWikiGetEVADetails(evaName) {
//   var url = './pullwiki.php?action=getEVADetails&evaName=' + evaName;
//   if (location.hostname === 'localhost') {
//       url = 'https://coda-dev.fit.nasa.gov/CODA_ISS/pullwiki.php?action=getEVADetails&evaName=' + evaName;
//   } else if (location.hostname === 'coda-iss.develop') { // use fake data if on dev
//       url = 'fakedata/getEVADetailsUS_EVA_55.json';
//   }
//   $.ajaxSetup({
//       scriptCharset: "utf-8",
//       contentType: "application/json; charset=utf-8"
//   });
//   return $.getJSON(
//       url,
//       function (resp) {
//           gEVADetails = createDetailsObject(resp);
//           gPlaybackGMT = '12:00:00';
//           displayEVADetails(gEVADetails);
//           console.log('ajaxWikiGetEVADetails completed.');
//       }).catch(function (jqXHR, textStatus, errorThrown) {
//       console.error(jqXHR);
//       console.error(textStatus);
//       console.error(errorThrown);
//   });
// }

// export function ajaxWikiGetEVADetailsByDate(evaDate) {
//   var url = './pullwiki.php?action=getEVADetailsByDate&evaDate=' + evaDate;
//   if (location.hostname === 'localhost') {
//       url = 'https://coda-dev.fit.nasa.gov/CODA_ISS/pullwiki.php?action=getEVADetailsByDate&evaDate=' + evaDate;
//   } else if (location.hostname === 'coda-iss.develop') { // use fake data if on dev
//       url = 'fakedata/getEVADetailsByDate2019-08-21.json';
//   }
//   $.ajaxSetup({
//       scriptCharset: "utf-8",
//       contentType: "application/json; charset=utf-8"
//   });
//   return $.getJSON(
//       url,
//       function (resp) {
//           gEVADetails = createDetailsObject(resp);

//           displayEVADetails(gEVADetails);
//           console.log('ajaxWikiGetEVADetailsByDate completed.');
//       }).catch(function (jqXHR, textStatus, errorThrown) {
//       console.error(jqXHR);
//       console.error(textStatus);
//       console.error(errorThrown);
//   });
// }

// function createDetailsObject(resp) {
//   var detailsObject = {};
//   detailsObject.evaName = Object.keys(resp['query']['results'])[0];
//   var resultObject = resp['query']['results'][detailsObject.evaName];

//   detailsObject.evaTitle = resultObject['printouts']['EVA title'][0];
//   detailsObject.startTime = resultObject['printouts']['Start time'][0];
//   detailsObject.duration = resultObject['printouts']['Duration'][0];
//   detailsObject.fullURL = resultObject['fullurl'];

//   var evaDate = resultObject['printouts']['Start date'][0]['raw'].substring(2);
//   var evaDateArray = evaDate.split('/');
//   detailsObject.evaDate = evaDateArray[0] + '-' + padZeros(evaDateArray[1], 2) + '-' + padZeros(evaDateArray[2], 2);

//   return detailsObject;
// }

// export function ajaxWikiGetCrew(evaName) {
//   var url = './pullwiki.php?action=getCrew&evaName=' + evaName;
//   if (location.hostname === 'localhost') {
//       url = 'https://coda-dev.fit.nasa.gov/CODA_ISS/pullwiki.php?action=getCrew&evaName=' + evaName;
//   } else if (location.hostname === 'coda-iss.develop') { // use fake data if on dev
//       url = 'fakedata/getCrewUS_EVA_55.json';
//   }
//   $.ajaxSetup({
//       scriptCharset: "utf-8",
//       contentType: "application/json; charset=utf-8"
//   });
//   return $.getJSON(
//       url,
//       function (resp) {
//           var crewObject = {};
//           var resultObject = resp['query']['results'];
//           for (var key in resultObject) {
//               if (resultObject.hasOwnProperty(key)) {
//                   crewObject[resultObject[key]['printouts']['Has role'][0]['fulltext']] = resultObject[key]['printouts']['Has full name'][0]['fulltext'];
//               }
//           }
//           document.getElementById("ev1TitleSpan").innerHTML = crewObject.EV1;
//           document.getElementById("ev2TitleSpan").innerHTML = crewObject.EV2;
//           console.log('ajaxWikiGetCrew completed.');
//       }).catch(function (jqXHR, textStatus, errorThrown) {
//       console.error(jqXHR);
//       console.error(textStatus);
//       console.error(errorThrown);
//   });
// }
