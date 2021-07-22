import { PseudoDropdown } from "components/dropdown-v2";
import FramePicker from "components/frame-picker";
import styles from "./frame.module.css";

export interface Options {
  id: number;
}

export function FrameHeader() {
  return (
    <div className={styles.header}>
      <div>
        <div className={styles.dropdown}>
          <PseudoDropdown color="grey" size="skinny" modal={FramePicker}>
            Pick a source
          </PseudoDropdown>
        </div>
      </div>
    </div>
  );
}

export default function Frame(options: React.PropsWithChildren<Options>) {
  return (
    <div className={styles.main}>
      <FrameHeader />
      {options.id}
    </div>
  );
}
