import { library } from "@fortawesome/fontawesome-svg-core";
import { faHamburger } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button from "components/button";
import { PseudoDropdown } from "components/dropdown-v2";
import LayoutPicker from "components/layout-picker";
import styles from "./header-v2.module.css";

library.add(faHamburger);

export function HamburgerMenu() {
  return (
    <Button color="lightest-grey">
      <FontAwesomeIcon icon="hamburger" />
    </Button>
  );
}

export function LayoutDropdown() {
  return (
    <PseudoDropdown modal={LayoutPicker} color="grey" caret="down">
      <img src="/icons/layout1.svg" alt="Layout 1" className={styles.layoutIcon} />
    </PseudoDropdown>
  );
}

export function SourcesDropdown() {
  return (
    <PseudoDropdown modal={LayoutPicker} color="grey" caret="down">
      <span className={styles.sourcesSelector}>ISS</span>
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
      <div className={styles.item}>
        <SourcesDropdown />
      </div>
    </div>
  );
}
