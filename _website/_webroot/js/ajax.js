function ajaxGetIoJSON( year, month, day, moreRows ) {

    var rangeStartYear = year,
        rangeStartMonth = month,
        rangeStartDay = day,
        rangeEndYear = year,
        rangeEndMonth = month,
        rangeEndDay = day;

    var iohost = "https://io.jsc.nasa.gov";

    var rangeStartIO = rangeStartMonth + "-" + rangeStartDay + "-" + rangeStartYear,
        rangeEndIO = rangeEndMonth + "-" + rangeEndDay + "-" + rangeEndYear,
        rangeStartTimeline = new Date( Date.UTC( rangeStartYear, rangeStartMonth, rangeStartDay ) - 60*60*1000 ),
        rangeEndTimeline = new Date( Date.UTC( rangeEndYear, rangeEndMonth, rangeEndDay ) + 6*60*60*1000 );


    var url = iohost + "/api/search/rpp=500&s_dt="+rangeStartIO+"&e_dt="+rangeEndIO+"&as=2?key=3E0556F2-EB15-69B9-4D8C0C12E07E8D37&format=json";
    //dev mod
    if (location.hostname === 'coda-iss.develop') { // use dev video location, otherwise use the stated IO URL
        url = 'fakedata/io.json';
    }

    return $.getJSON(
        url,
        {},
        function (resp) {
            var docs = resp.results.response.docs,
                output = "",
                className,
                beyondSixGroupId,
                nonDownlinkGroupId,
                earliestStart,
                latestEnd;
            // console.log(resp);
            // console.log(docs);

            var groups = [
                {id:0, content: "D/L 01", value: 1},
                {id:1, content: "D/L 02", value: 2},
                {id:2, content: "D/L 03", value: 3},
                {id:3, content: "D/L 04", value: 4},
                {id:4, content: "D/L 05", value: 5},
                {id:5, content: "D/L 06", value: 6}
            ];

            var allowDownlinksBeyondSix = false;
            var allowNonDownlinks = true;

            if ( allowDownlinksBeyondSix ) {
                beyondSixGroupId = groups.length;
                groups.push({id: beyondSixGroupId, content: "Other D/L", value: beyondSixGroupId + 1});
            }

            if ( allowNonDownlinks ) {
                nonDownlinkGroupId = groups.length;
                groups.push({id: nonDownlinkGroupId, content: "Non-Downlink", value: nonDownlinkGroupId + 1 });
            }

            for ( var i = 0; i < docs.length; i++ ) {
                var d = docs[i];

                var channel = getChannel( d.collections_string );

                if ( channel ) {
                    if ( ["01","02","03","04","05","06"].indexOf( channel ) > -1 ) {
                        className = "downlink-"+channel;
                        var group = parseInt( channel ) - 1;
                    }
                    else {
                        if( ! allowDownlinksBeyondSix ) continue;
                        className = "downlink-other";
                        group = beyondSixGroupId;
                    }
                    var content = d.md_title;
                }
                else {
                    // FOR NOW, FILTERING OUT NON DOWNLINKS
                    if ( ! allowNonDownlinks ) {
                        continue;
                    }

                    className = "non-downlink-video";
                    content = "Non-Downlink: " + d.md_title;
                    group = nonDownlinkGroupId;
                }

                if ( ! d.duration_seconds ) {
                    d.duration_seconds = 0;
                }
                d.duration_ms = d.duration_seconds * 1000;

                // Create array of date elements from creation date
                var dateArr = d.md_creation_date
                    .match( /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z/ ) // regex match for the date
                    .slice(1) // remove the first item (the full matched string)
                    .map(function(n){ return parseInt(n); }); // for each element, convert to integer

                //********** EXCEPTION for video recorded during LOS
                // NASA IDs are like iss053m532781939
                // Breakdown:
                // iss  = ISS video
                // 053  = Expedition 53
                // m    = moving imagery e.g. video
                // 53   = Downlink 3, downlinked after an LOS. Realtime downlink would be 03
                // 278  = GMT day 278
                // 1939 = Actual start time of the video
                //
                // Note that 19:39 is the actual GMT start time of this video for a non-realtime
                // downlink. The "Start GMT" listed in IO is wrong, stating GMT 0600.
                var id_metadata = d.nasa_id.match( /iss\d{3}m(\d)(\d)\d+(\d{2})(\d{2})/ );
                if ( id_metadata && id_metadata[1] === "5" ) {
                    dateArr[3] = id_metadata[3];
                    dateArr[4] = id_metadata[4];
                    dateArr[5] = "00";
                    className = "downlink-LOS";
                }

                // create date object. Note, month is 0-11 in javascript.
                var UTCstartMilliseconds = Date.UTC(
                    dateArr[0], dateArr[1] - 1, dateArr[2], dateArr[3], dateArr[4], dateArr[5]
                );
                var UTCstart = new Date( UTCstartMilliseconds ),
                    UTCend = new Date( UTCstartMilliseconds + d.duration_ms );
                var dateString = function( a ) {
                    return a.toJSON().slice(0,10) + " " + a.toJSON().slice(11,19);
                    // return a.getUTCFullYear() + '-' + a.getUTCMonth() + '-' + a.getUTCDate()
                    // + ' ' + a.getUTCHours() + ':' + a.getUTCMinutes() + ':' + a.getUTCSeconds();
                };

                if ( !gTimingData['video_earliestStart'] || UTCstart.getTime() < gTimingData['video_earliestStart'].getTime() ) {
                    gTimingData['video_earliestStart'] = new Date( UTCstart.toUTCString() );
                }
                if ( !gTimingData['video_latestEnd'] || UTCend.getTime() > gTimingData['video_latestEnd'].getTime() ) {
                    gTimingData['video_latestEnd'] = new Date( UTCend.toUTCString() );
                }

                var url = iohost + "/app/info.cfm?pid=" + d.id;

                var videoUrl = iohost + d.webpath + '/video/' + d.nasa_id + "." + d.file_extension_video;
                // console.log(videoUrl);

                if (className === 'downlink-LOS') {
                    var priority = 0;
                } else {
                    priority = 1;
                }

                gVideoItems.push({
                    id: i + 1,
                    content: content,
                    description: d.description,
                    start: UTCstart,
                    end: UTCend,
                    url: url,
                    videoUrl: videoUrl,
                    className: className,
                    priority: priority,
                    md_creation_date: d.md_creation_date,
                    group: group
                });
            }
            gTimingData['EVA_duration_seconds'] = (gTimingData['video_latestEnd'] - gTimingData['video_earliestStart']) / 1000;

            for (i = 0; i < gVideoItems.length; i++) {
                gVideoItems[i]['missionSecondsStart'] = (gVideoItems[i]['start'] - gTimingData['video_earliestStart']) / 1000;
                gVideoItems[i]['missionSecondsEnd'] = (gVideoItems[i]['end'] - gTimingData['video_earliestStart']) / 1000;
                gVideoItems[i]['durationSeconds'] = gVideoItems[i]['missionSecondsEnd'] - gVideoItems[i]['missionSecondsStart'];
            }

            gVideoItems.sort( //sorts by priority first, then duration second. Counterintuitively, this array is later used to choose the item with the highest array position for the preferred video stream for a given group and time.
                function(a, b)
                {
                    return (+(a.priority > b.priority) || +(a.priority === b.priority) - 1) ||
                        (+(a.durationSeconds > b.durationSeconds) || +(a.durationSeconds === b.durationSeconds) - 1);
                });

            createMissionVideoActivity();
        });
}

function createMissionVideoActivity() {
    var t0 = performance.now();
    for (var group = 0; group <= 6; group++) {
        var groupSecondsArray = [];
        for (var second = 0; second < gTimingData.EVA_duration_seconds; second++) {
            var vidsThisGroupThisSecond = [];
            for (var i = 0; i < gVideoItems.length; i++) {
                if (gVideoItems[i].group === group && (second >= gVideoItems[i].missionSecondsStart && second <= gVideoItems[i].missionSecondsEnd)) {
                    vidsThisGroupThisSecond.push(i);
                }
            }
            if (vidsThisGroupThisSecond.length > 0)
                var vidIndex = vidsThisGroupThisSecond[vidsThisGroupThisSecond.length - 1];
            else
                vidIndex = -1;
            groupSecondsArray.push(vidIndex)
        }
        gVideoActivityByGroupBySecond.push(groupSecondsArray);
    }
    var t1 = performance.now();
    console.log("createMissionVideoActivity took " + (t1 - t0) + " milliseconds.")
}

function getChannel ( collectionStrings ) {
    var channel = null;

    // loop through collections strings for each result
    for ( var j = 0; j < collectionStrings.length; j++ ) {
        var chMatch = collectionStrings[j].match( /US Downlink\|Channel (\d+)/ );

        // if there is a channel match
        if ( chMatch ) {
            if ( Array.isArray(channel) ) {
                channel.push(chMatch[1]);
            }
            else if (typeof channel === 'string' || channel instanceof String) {
                channel = [ channel, chMatch[1] ];
            }
            else {
                channel = chMatch[1];
            }

        }
    }

    if ( Array.isArray( channel ) ) {
        // console.warn( "Multiple downlink channels found" );
        return channel[0];
    }
    else {
        return channel;
    }
}


function ajaxGetEV1ActivityJSON() {
    return $.getJSON(
        'fakedata/EV1_as-executed.json',
        {},
        function (resp) {
            gVideoActivity.EV1 = createActivityArrayFromJSON(resp);
            console.log('ajaxGetEV1ActivityJSON completed.');
        });
}

function ajaxGetEV2ActivityJSON() {
    return $.getJSON(
        'fakedata/EV2_as-executed.json',
        {},
        function (resp) {
            gVideoActivity.EV2 = createActivityArrayFromJSON(resp);
            console.log('ajaxGetEV1ActivityJSON completed.');
        });
}

function createActivityArrayFromJSON(resp) {
    var dateArr = resp.startGMT.split(/-| |:/).map(Number);
    var ActivityStartUTCMilliseconds = Date.UTC(
        dateArr[0], dateArr[1] - 1, dateArr[2], dateArr[3], dateArr[4], dateArr[5]
    );
    var activityArray = [];
    var activityStartTimeSeconds = (ActivityStartUTCMilliseconds - gTimingData.video_earliestStart.getTime()) / 1000;
    var thisStartTimeSeconds = activityStartTimeSeconds;
    for (var i=0; i < resp.events.length; i++) {
        var activityObject = {
            content: resp.events[i].content,
            startTimeSeconds: thisStartTimeSeconds,
            endTimeSeconds: thisStartTimeSeconds + (resp.events[i]['duration_min'] * 60)
        };
        thisStartTimeSeconds = thisStartTimeSeconds + (resp.events[i]['duration_min'] * 60);
        activityArray.push(activityObject);
    }
    return activityArray
}

function ajaxGetAudioMetadataJSON() {
    $.ajaxSetup({
        scriptCharset: "utf-8",
        contentType: "application/json; charset=utf-8"
    });
    return $.getJSON(
        '/CODA_data/US_EVA_55/audio/US_EVA_55_audio_metadata.json',
        {},
        function (resp) {
            gAudioMetadata = resp;

            for (var i = 0; i < gAudioMetadata.length; i++) {
                gAudioMetadata[i].startTimeSeconds = (new Date(gAudioMetadata[i].start_time) - gTimingData.video_earliestStart) / 1000;
                gAudioMetadata[i].endTimeSeconds = (new Date(gAudioMetadata[i].end_time) - gTimingData.video_earliestStart) / 1000;
            }
            console.log('ajaxGetAudioMetadataJSON completed.');
        }).catch(function (jqXHR, textStatus, errorThrown) {
        console.error(jqXHR);
        console.error(textStatus);
        console.error(errorThrown);
    });
}

