import _ from "lodash";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "store/index";
import styles from "./preset-picker.module.css";
import { allPresets } from "store/framework-presets";
import { setAllFrameworkState } from "store/framework";
import { useCookies } from "react-cookie";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
const LZUTF8 = require("lzutf8");
import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";

library.add(faTrash);

export default function PresetPicker({ closeClick }: { closeClick?: () => void }) {
  const frameworkState = useSelector((state: RootState) => state.framework);
  const dispatch = useDispatch();

  const [helpOpen, setHelpOpen] = useState(false);
  const [userPresetsCookie, setUserPresetsCookie] = useCookies(["CODA_UserPresets"]);
  const [userPresets, setUserPresets] = useState<Preset[]>([]);
  const [presetNameField, setPresetNameField] = useState("");

  const handleSelectPreset = (preset: Preset) => (e: React.MouseEvent) => {
    e.preventDefault();
    const newFrameworkState: FrameworkState = {
      ...frameworkState,
      layout: preset.layout,
      frames: preset.frames,
    };
    dispatch(setAllFrameworkState(newFrameworkState));

    closeClick();
  };

  const saveUserPreset = () => (e: React.MouseEvent) => {
    e.preventDefault();
    const newPreset: Preset = {
      uuid: uuidv4(),
      layout: frameworkState.layout,
      frames: frameworkState.frames,
      name: presetNameField,
    };

    const newUserPresets = [...userPresets, newPreset];
    setUserPresets(newUserPresets);
    const compressedUserPresets = LZUTF8.compress(JSON.stringify(newUserPresets), {
      outputEncoding: "Base64",
    });
    setUserPresetsCookie("CODA_UserPresets", compressedUserPresets, { path: "/" });
  };

  const deleteUserPreset = (preset: Preset) => (e: React.MouseEvent) => {
    e.preventDefault();
    const newUserPresets = _.filter(userPresets, (p) => p.uuid !== preset.uuid);
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
  }, []);

  return (
    <div className={styles.main}>
      <div className={styles.top}>
        <div>Preset Displays</div>
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

      <hr />
      <div className={styles.presets}>
        <div>User Presets</div>

        {userPresets.length > 0 ? (
          userPresets.map((preset) => (
            <div className={styles.presetItem} key={preset.name}>
              <div className={styles.option} onClick={handleSelectPreset(preset)}>
                <div className={styles.verticalCenter}>{preset.name}</div>
              </div>
              <div className={styles.delete} onClick={deleteUserPreset(preset)}>
                <FontAwesomeIcon icon="trash" />
              </div>
            </div>
          ))
        ) : (
          <span>No available presets</span>
        )}
        <div className={styles.saveUserPreset}>
          <label>
            Save Current View as Preset
            <input
              type="text"
              name="presetname"
              placeholder="Preset Name"
              value={presetNameField}
              onChange={(e) => setPresetNameField(e.target.value)}
            />
          </label>
          <button onClick={saveUserPreset()}>Save</button>
        </div>
      </div>
      <hr />
      <div className={styles.presets}>
        <div>System Presets</div>
        {allPresets.length > 0 ? (
          allPresets.map((preset) => (
            <div className={styles.presetItem} key={preset.name}>
              <div className={styles.option} onClick={handleSelectPreset(preset)}>
                <div className={styles.verticalCenter}>{preset.name}</div>
              </div>
            </div>
          ))
        ) : (
          <span>No available presets</span>
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
}
