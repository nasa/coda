import filter from "lodash/filter";
import { deepEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import styles from "./preset-picker.module.css";
import { allPresets } from "store/framework-presets";
import { setAllFrameworkState } from "store/framework";
import { useCookies } from "react-cookie";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import LZUTF8 from "lzutf8";
import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { getDockviewApi } from "./dockview-layout";

const PresetPicker = ({ closeClick }: { closeClick?: () => void }): React.JSX.Element => {
  const framework = useAppSelector((state) => state.framework, deepEqual);
  const dispatch = useAppDispatch();

  const [helpOpen, setHelpOpen] = useState(false);
  const [userPresetsCookie, setUserPresetsCookie] = useCookies(["CODA_UserPresets"]);
  const [userPresets, setUserPresets] = useState<Preset[]>([]);
  const [presetNameField, setPresetNameField] = useState("");

  const handleSelectPreset = (preset: Preset) => (e: React.MouseEvent) => {
    e.preventDefault();
    const newFrameworkState: FrameworkState = {
      ...framework,
      layout: preset.layout,
      frames: preset.frames,
      // v3 presets include a serialized Dockview layout; v2 presets use the letter system
      dockviewLayout: preset.version === 3 && preset.dockviewLayout ? preset.dockviewLayout : null,
    };
    dispatch(setAllFrameworkState(newFrameworkState));
    closeClick?.();
  };

  const saveUserPreset = () => (e: React.MouseEvent) => {
    e.preventDefault();
    const dockviewApi = getDockviewApi();
    const newPreset: Preset = {
      uuid: uuidv4(),
      layout: framework.layout,
      frames: framework.frames,
      name: presetNameField,
      version: 3,
      // Capture the current Dockview layout so proportions and arrangement are restored
      dockviewLayout: dockviewApi ? dockviewApi.toJSON() : undefined,
    };

    const newUserPresets = [...userPresets, newPreset];
    setUserPresets(newUserPresets);
    const compressedUserPresets = LZUTF8.compress(JSON.stringify(newUserPresets), {
      outputEncoding: "Base64",
    });
    setUserPresetsCookie("CODA_UserPresets", compressedUserPresets, { path: "/" });
    setPresetNameField("");
  };

  const deleteUserPreset = (preset: Preset) => (e: React.MouseEvent) => {
    e.preventDefault();
    const newUserPresets = filter(userPresets, (p) => p.uuid !== preset.uuid);
    if (newUserPresets) {
      const compressedUserPresets = LZUTF8.compress(JSON.stringify(newUserPresets), {
        outputEncoding: "Base64",
      });
      setUserPresets(newUserPresets);
      setUserPresetsCookie("CODA_UserPresets", compressedUserPresets, { path: "/" });
    } else {
      setUserPresets([]);
      setUserPresetsCookie("CODA_UserPresets", "", { path: "/" });
    }
  };

  useEffect(() => {
    if (userPresetsCookie["CODA_UserPresets"]) {
      const presetsInCookie = LZUTF8.decompress(userPresetsCookie["CODA_UserPresets"], {
        inputEncoding: "Base64",
      });
      try {
        if (presetsInCookie.length > 0) {
          setUserPresets(JSON.parse(presetsInCookie));
        }
      } catch (e) {
        setUserPresets([]);
        console.error(e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount to load from cookie
  }, []);

  return (
    <div className={styles.main}>
      <div className={styles.top}>
        <div className={styles.topLeft}>
          <div>Save or Select a Preset</div>
        </div>
        <div className={styles.topRight}>
          <div className={styles.verticalCenter}>
            <HelpButton
              clickHandler={() => {
                setHelpOpen(!helpOpen);
              }}
            />
          </div>
          {closeClick && (
            <div className={styles.close} onClick={closeClick}>
              ✕
            </div>
          )}
        </div>
      </div>
      <div className={styles.presets}>
        <div className={styles.title}>Your Presets</div>

        {userPresets.length > 0 ? (
          userPresets.map((preset) => (
            <div className={styles.presetItem} key={preset.name}>
              <div className={styles.option} onClick={handleSelectPreset(preset)}>
                <div className={styles.verticalCenter}>{preset.name}</div>
              </div>
              <div className={styles.delete} onClick={deleteUserPreset(preset)}>
                <FontAwesomeIcon icon={faTrash} />
              </div>
            </div>
          ))
        ) : (
          <span className={styles.noPresets}>No presets created</span>
        )}
        <div className={styles.saveUserPreset}>
          <div className={styles.title}>Save Current View as Preset</div>
          <div className={styles.inputBoxContainer}>
            <input
              type="text"
              name="presetname"
              placeholder="Preset Name"
              value={presetNameField}
              className={styles.inputBox}
              onChange={(e) => setPresetNameField(e.target.value)}
            />
            <div className={styles.verticalCenter}>
              <button
                className={styles.button}
                style={{ width: "50px" }}
                onClick={saveUserPreset()}
              >
                <span className={styles.buttonLabel}>Save</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.presets}>
        <div className={styles.title}>CODA System Presets</div>
        {allPresets.length > 0 ? (
          allPresets.map((preset) => (
            <div className={styles.presetItem} key={preset.name}>
              <div className={styles.option} onClick={handleSelectPreset(preset)}>
                <div className={styles.verticalCenter}>{preset.name}</div>
              </div>
            </div>
          ))
        ) : (
          <span style={{ fontStyle: "italic" }}>No presets created</span>
        )}
      </div>
      <HelpOverlay
        isModalOpen={helpOpen}
        closeHandler={() => {
          setHelpOpen(false);
        }}
      >
        <div>
          <p>Presets contain the selected CODA Layout and applications selected for each frame.</p>
          <p>
            If you use a specific configuration often, you can save it as a preset and restore it
            every time you open CODA.
          </p>
          <p>
            Presets are stored in your browser's cookies. If you clear your cookies, you will lose
            all your presets.
          </p>
        </div>
      </HelpOverlay>
    </div>
  );
};

export default PresetPicker;
