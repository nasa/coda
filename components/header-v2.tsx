import Button from "components/button";
import { PseudoDropdown } from "components/dropdown-v2";
import LayoutPicker from "components/layout-picker";
import styles from "./header-v2.module.css";

export function HamburgerMenu() {
  // TODO: need hamburger icon
  return (
    <div>
      <Button>-</Button>
    </div>
  );
}

export function LayoutDropdown() {
  return (
    <PseudoDropdown modal={LayoutPicker} color="white" carat="right">
      Layouts
    </PseudoDropdown>
  );
}

export default function Header() {
  return (
    <div className={styles.main}>
      <HamburgerMenu />
      <div className={styles.layouts}>
        <LayoutDropdown />
      </div>
    </div>
  );
}
