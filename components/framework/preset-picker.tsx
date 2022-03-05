import _ from "lodash";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "store/index";
import styles from "./preset-picker.module.css";
import { allPresets } from "store/framework-presets";
import { setAllFrameworkState } from "store/framework";

export default function PresetPicker({ closeClick }: { closeClick?: () => void }) {
  const frameworkState = useSelector((state: RootState) => state.framework);
  const dispatch = useDispatch();

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

  return (
    <div className={styles.main}>
      <div className={styles.top}>
        <div>Select a Preset Display</div>
        {closeClick && (
          <div className={styles.close} onClick={closeClick}>
            ✕
          </div>
        )}
      </div>
      <div className={styles.presets}>
        {allPresets.length > 0 ? (
          allPresets.map((preset) => (
            // <div className={styles.option} onClick={handleSelectPreset(preset)} key={preset.name}>
            //   {preset.name}
            // </div>
            <div className={styles.option} onClick={handleSelectPreset(preset)} key={preset.name}>
              <div className={styles.verticalCenter}>{preset.name}</div>
            </div>
          ))
        ) : (
          <span>No available presets</span>
        )}
      </div>
    </div>
  );
}
