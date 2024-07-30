import { useNavigate } from "react-router-dom";
import styles from "./index.module.css";

export default function Index() {
  const navigate = useNavigate();
  // ? It technically works,
  // ? but I dont want to hardcode some images in this file. try might create some sort of list component (/images/background_img_list.tsx)?
  // ! testing purposes only
  const images: string[] = [
    "https://io.jsc.nasa.gov/photos/12558/hires/iss057e106068.jpg",
    "https://io.jsc.nasa.gov/photos/13524/hires/iss068e059945.jpg",
    "https://io.jsc.nasa.gov/photos/13476/hires/iss068e008480.jpg",
    "https://io.jsc.nasa.gov/photos/13257/hires/iss066e146298.jpg",
    "https://io.jsc.nasa.gov/photos/13260/hires/iss066e152140.jpg",
    "https://io.jsc.nasa.gov/photos/12558/hires/iss057e106044.jpg",
    "https://io.jsc.nasa.gov/photos/11891/hires/iss048e010128.jpg",
  ];

  const randomImage: string = images[Math.floor(Math.random() * images.length)];

  // ? technically works, is it possible to put this within a css file by passing it a variable?
  return (
    <div className={styles.main} style={{ backgroundImage: `url(${randomImage})` }}>
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
