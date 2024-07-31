import { useNavigate } from "react-router-dom";
import { codaBackgrounds } from "public/images/coda-background-images";
import styles from "./index.module.css";

export default function Index() {
  const navigate = useNavigate();
  const randomImage: string = codaBackgrounds[Math.floor(Math.random() * codaBackgrounds.length)];
  document.documentElement.style.setProperty("--background-image", `url(${randomImage})`);

  return (
    <div className={styles.main}>
      <title>CODA</title>
      <div className={styles.container}>
        <div className={styles.verticalCenter}>
          <div className={styles.description}>
            <div className={styles.logo}>
              <div className={styles.verticalCenter}>
                <img className={styles.meatball} src="/images/logo_NASA.svg" alt="NASA meatball" />
              </div>
              <div className={styles.verticalCenter}>
                <span className={styles.wordMark}>CODA</span>
              </div>
            </div>
            <div className={styles.description}>
              <div className={styles.strong}>Collaborative Operations Data Activation</div>
              <p>
                Consolidating the context of mission, training, and testing data into an exploratory
                platform to relive and analyze each moment
              </p>
              <p>A JSC collaboration between XI, CX, and SK</p>
            </div>
          </div>
        </div>
        <div className={styles.verticalCenter}>
          <div className={styles.sources}>
            <div className={styles.sourcesPanel}>
              <div className={styles.sourcesHeader}>Select a Source</div>
              <ul className={styles.ul}>
                <li className={styles.li}>
                  <div
                    onClick={() => {
                      navigate("/view/?s=3");
                    }}
                  >
                    Artemis
                  </div>
                </li>
                <li className={styles.li}>
                  <div
                    onClick={() => {
                      navigate("/view/?s=0");
                    }}
                  >
                    ISS
                  </div>
                </li>
                <li className={styles.li}>
                  <div
                    onClick={() => {
                      navigate("/view/?s=2");
                    }}
                  >
                    NBL
                  </div>
                </li>
                <li className={styles.li}>
                  <div
                    onClick={() => {
                      navigate("/view/?s=1");
                    }}
                  >
                    Test Events
                  </div>
                </li>
                <li className={styles.li}>
                  <span className={styles.disabled} title="Coming soon!">
                    Mars
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
