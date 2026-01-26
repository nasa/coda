import { getCurrentUser } from "packages/getCurrentUser";
import { FunctionComponent, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { isSuperuser } from "utils/user";
import styles from "./index.module.css";
import adminCommon from "./adminCommon.module.css";

interface NavCardProps {
  to: string;
  title: string;
  description: string;
}

const NavCard: FunctionComponent<NavCardProps> = ({ to, title, description }) => (
  <Link to={to} className={styles.navCard}>
    <h3 className={styles.navCardTitle}>{title}</h3>
    <p className={styles.navCardDescription}>{description}</p>
  </Link>
);

const AdminIndex: FunctionComponent = () => {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user instanceof Error || !isSuperuser(user)) {
        navigate("/");
        return;
      }
    })();
  }, [navigate]);

  return (
    <main className={adminCommon.page}>
      <div className={adminCommon.container}>
        <header className={styles.pageHeader}>
          <div className={styles.headerLeft}>
            <img src="/images/EMSS.svg" alt="EMSS Emblem" className={styles.emblem} />
            <div>
              <h1 className={styles.wordMark}>CODA</h1>
              <p className={adminCommon.introText}>
                Manage data records, monitor system status, and configure application settings.
              </p>
            </div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.logoEmss} title="EMSS" />
            <img src="/images/logo_NASA.svg" alt="NASA" className={styles.meatball} />
          </div>
        </header>

        {/* Data Management Section */}
        <section className={adminCommon.section} aria-labelledby="data-management-heading">
          <h2 id="data-management-heading" className={adminCommon.sectionHeading}>
            Data Management
          </h2>
          <div className={adminCommon.details}>
            <nav className={styles.navGrid} aria-label="Data management navigation">
              <NavCard
                to="/admin/gps"
                title="GPS Data"
                description="Manage GPS tracks stored in GPX format for field tests and position tracking."
              />
              <NavCard
                to="/admin/mediaOverrides"
                title="Media Overrides"
                description="Configure media source overrides and custom media mappings."
              />
              <NavCard
                to="/admin/ancillaryData"
                title="Ancillary Data Sources"
                description="Manage external data source URLs for graphing and visualization."
              />
              <NavCard
                to="/admin/videoStartTimeOverrides"
                title="Video Start Time Overrides"
                description="Adjust video start times for synchronization and playback corrections."
              />
              <NavCard
                to="/admin/photoTimeShifts"
                title="Photo Time Shifts"
                description="Configure time shift corrections for photo timestamps."
              />
              <NavCard
                to="/admin/ephemeris"
                title="Ephemeris Data"
                description="View and manage ISS TLE data for orbit calculations and position tracking."
              />
            </nav>
          </div>
        </section>

        {/* System Management Section */}
        <section className={adminCommon.section} aria-labelledby="system-management-heading">
          <h2 id="system-management-heading" className={adminCommon.sectionHeading}>
            System Management
          </h2>
          <div className={adminCommon.details}>
            <nav className={styles.navGrid} aria-label="System monitoring navigation">
              <NavCard
                to="/admin/fetchInspector"
                title="Data Fetching Inspector"
                description="Real-time monitoring of backend data retrieval activity and status."
              />
              <NavCard
                to="/admin/socketStatus"
                title="Visitor Activity"
                description="Real-time management of all connected visitors organized by source and viewing date."
              />
              <NavCard
                to="/admin/talkybotSocketStatus"
                title="Talkybot S2s Connection Monitor"
                description="Monitor the server-to-server socket connection to Talkybot."
              />
            </nav>
          </div>
        </section>
      </div>
    </main>
  );
};

export default AdminIndex;
