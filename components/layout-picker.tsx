import styles from "./layout-picker.module.css";

export default function LayoutPicker({ closeClick }: { closeClick: () => void }) {
  return (
    <div className={styles.main}>
      <div className={styles.top}>
        <div>Layout Picker</div>
        <div onClick={closeClick}>x</div>
      </div>
      LAYOUTS
    </div>
  );
}
