/**
 * Create store of single run
 */
export async function buildRunStore(runName: string): Promise<Run> {
  const run = await getRun(runName);
  for (let i = 0; i < run.colors.length; i++) {
    run.colors[i].tagNames = await getTagnames(run.run_metadata.run_name, run.colors[i].color);
  }
  run.run_metadata.fieldKeys = await getDBFFieldsKey();

  //find the video for EV1
  let ev1Index = 0;
  for (let x = 0; x < run.videos.length; x++) {
    if (run.videos[x].EV_number === "EV1") {
      ev1Index = x;
      break;
    }
  }

  //grab waveform data for each video segment
  const videoSelected = run.videos[ev1Index];
  for (let i = 0; i < videoSelected.video_segments.length; i++) {
    const filename = videoSelected.video_segments[i].segment_filename.split(".mp4")[0] + ".dat";
    const dataPath = `${process.env.RUN_DATA_ROOT_URL}/${run.run_metadata.run_name}/video_feeds/${filename}`;
    videoSelected.video_segments[i].waveformData = await getWaveformData(dataPath);
  }
  return run;
}
