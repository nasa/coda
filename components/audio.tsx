import styles from "./audio.module.css";

const playAudio = (_a) => {};

// TODO: should this come from an external source?
const buttons = [
  {
    id: 0,
    name: "1S/G-1",
  },
  {
    id: 1,
    name: "1S/G-2",
  },
  {
    id: 2,
    name: "EVA COORD ISS1",
  },
  {
    id: 3,
    name: "ISS FD1",
  },
  {
    id: 4,
    name: "EVA PROCED ISS1",
  },
  {
    id: 5,
    name: "EVA ISS1",
  },
];

/**
 * Renders an audio channel selector and plays the audio
 */
function Audios() {
  const channelButton = (id: number, name: string) => (
    <button
      id={`audioButton${id}`}
      key={`AUDIO_BUTTON_${id}`}
      type="button"
      className={styles.audioButton}
      onClick={() => playAudio(id)}
    >
      {name}
    </button>
  );

  return (
    <div className={styles.audioPanel}>
      <div className={styles.title}>Audio Channels</div>
      <div id="audioButtonsContainer">
        {buttons.map((b) => channelButton(b.id, b.name))}
      </div>
    </div>
  );
}

export default Audios;
