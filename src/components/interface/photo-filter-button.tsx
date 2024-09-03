import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./photo-filter-button.module.css";
import { faFilter } from "@fortawesome/free-solid-svg-icons";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "store";
import { setCollectionFilters } from "store/photos";

export function FilterButton(props: {
  clickHandler: () => void;
  selected?: boolean;
  frameDimensions: number[];
}) {
  const buttonLength = props.frameDimensions[0] > 470 ? styles.buttonLong : styles.buttonShort;
  const selectedStyle = props.selected ? styles.selected : "";
  return (
    <button
      className={`${styles.filterButton} ${buttonLength} ${selectedStyle}`}
      onClick={() => {
        props.clickHandler();
      }}
    >
      <span className={styles.filterLabel}>
        <div>{props.frameDimensions[0] > 470 ? "Filter" : ""}</div>
        <div>
          <FontAwesomeIcon icon={faFilter} size="sm" />
        </div>
      </span>
    </button>
  );
}

export const RenderPhotoFilter = () => {
  const dispatch = useDispatch();
  const photos: PhotosState = useSelector((state: RootState) => state.photos);

  const changeFilter = (index: number, value: boolean) => {
    let filters = JSON.parse(JSON.stringify(photos.collectionFilters));
    filters[index].selected = value;
    dispatch(setCollectionFilters(filters));
  };

  const changeAllFilters = (value: boolean) => {
    let filters = JSON.parse(JSON.stringify(photos.collectionFilters));
    for (let i = 0; i < filters.length; i++) {
      filters[i].selected = value;
    }
    dispatch(setCollectionFilters(filters));
  };

  return (
    <div className={`${styles.photoOverlay}`} style={{ display: "block" }}>
      <table className={styles.overlayTable}>
        <tbody>
          <tr className={styles.overlayTableRow}>
            <td className={`${styles.overlayTableCell} ${styles.titleRow}`}></td>
            <td className={`${styles.overlayTableCell}`}>
              <button
                className={styles.filterButton}
                style={{ width: "70px" }}
                onClick={() => {
                  changeAllFilters(true);
                }}
              >
                Check All
              </button>
              <button
                className={styles.filterButton}
                style={{ marginLeft: "0.5em", width: "80px" }}
                onClick={() => {
                  changeAllFilters(false);
                }}
              >
                Check None
              </button>
            </td>
          </tr>
          {photos.collectionFilters.map((value, index) => {
            return (
              <tr key={index} className={styles.overlayTableRow}>
                <td className={`${styles.overlayTableCell} ${styles.titleRow}`}>
                  <input
                    className={styles.tableInput}
                    type="checkbox"
                    checked={value.selected}
                    onChange={() => {
                      changeFilter(index, !value.selected);
                    }}
                  />
                </td>
                <td className={`${styles.overlayTableCell}`}>{value.display}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
