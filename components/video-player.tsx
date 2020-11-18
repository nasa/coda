const loadVideo = (_a, _b, _c) => {};
const gCurrMissionTimeSeconds = 0;

function VideoPlayer({ id, gVideoActivityByGroupBySecond }) {
  return (
    <div className="vidPanel">
      <div>
        <button
          id="vid0Button0"
          type="button"
          className="vidButton"
          onClick={() => loadVideo(id, 0, gCurrMissionTimeSeconds)}
        >
          D/L 1
        </button>
        <button
          id="vid0Button1"
          type="button"
          className="vidButton"
          onClick={() => loadVideo(id, 1, gCurrMissionTimeSeconds)}
        >
          D/L 2
        </button>
        <button
          id="vid0Button2"
          type="button"
          className="vidButton"
          onClick={() => loadVideo(id, 2, gCurrMissionTimeSeconds)}
        >
          D/L 3
        </button>
        <button
          id="vid0Button3"
          type="button"
          className="vidButton"
          onClick={() => loadVideo(id, 3, gCurrMissionTimeSeconds)}
        >
          D/L 4
        </button>
        <button
          id="vid0Button4"
          type="button"
          className="vidButton"
          onClick={() => loadVideo(id, 4, gCurrMissionTimeSeconds)}
        >
          D/L 5
        </button>
        <button
          id="vid0Button5"
          type="button"
          className="vidButton"
          onClick={() => loadVideo(id, 5, gCurrMissionTimeSeconds)}
        >
          D/L 6
        </button>
        <button
          id="vid0Button6"
          type="button"
          className="vidButton"
          onClick={() => loadVideo(id, 6, gCurrMissionTimeSeconds)}
        >
          non-D/L
        </button>
      </div>

      <div id="vidTitle0" className="vidTitle">
        vidTitle
      </div>
      <div className="vidContainer">
        <video className="player" id={id} controls></video>
        <div className="vidOverlay">
          <div id="vidInfo0" className="vidInfo">
            vidInfo
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
