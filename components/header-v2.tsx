import Button from "components/button";
import { PseudoDropdown } from "components/dropdown-v2";
import LayoutPicker from "components/layout-picker";
import styles from "./header-v2.module.css";

export function HamburgerMenu() {
  // TODO: need hamburger icon
  return <Button>-</Button>;
}

export function LayoutDropdown() {
  return (
    <PseudoDropdown modal={LayoutPicker} color="grey" caret="down">
      <img src="/icons/layout1.svg" alt="Layout 1" className={styles.layoutIcon} />
    </PseudoDropdown>
  );
}

export default function Header() {
  return (
    <div className={styles.main}>
      <div className={styles.item}>
        <HamburgerMenu />
      </div>
      <div className={styles.item}>
        <LayoutDropdown />
      </div>
    </div>
  );
}
