import styles from "./layout-picker.module.css";

export default function LayoutPicker({ closeClick }: { closeClick?: () => void }) {
  return (
    <div className={styles.main}>
      <div className={styles.top}>
        <div>Select a Layout</div>
        {closeClick && <div onClick={closeClick}>✕</div>}
      </div>
      <div className={styles.layouts}>
        <div className={styles.layout}>
          <img src="/icons/layout1.svg" alt="Layout 1" />
        </div>
        <div className={styles.layout}>
          <img src="/icons/layout1.svg" alt="Layout 1" />
        </div>
        <div className={styles.layout}>
          <img src="/icons/layout1.svg" alt="Layout 1" />
        </div>
        <div className={styles.layout}>
          <img src="/icons/layout1.svg" alt="Layout 1" />
        </div>
        <div className={styles.layout}>
          <img src="/icons/layout1.svg" alt="Layout 1" />
        </div>
        <div className={styles.layout}>
          <img src="/icons/layout1.svg" alt="Layout 1" />
        </div>
        <div className={styles.layout}>
          <img src="/icons/layout1.svg" alt="Layout 1" />
        </div>
        <div className={styles.layout}>
          <img src="/icons/layout1.svg" alt="Layout 1" />
        </div>
        <div className={styles.layout}>
          <img src="/icons/layout1.svg" alt="Layout 1" />
        </div>
        <div className={styles.layout}>
          <img src="/icons/layout1.svg" alt="Layout 1" />
        </div>
        <div className={styles.layout}>
          <img src="/icons/layout1.svg" alt="Layout 1" />
        </div>
        <div className={styles.layout}>
          <img src="/icons/layout1.svg" alt="Layout 1" />
        </div>
      </div>
    </div>
  );
}
