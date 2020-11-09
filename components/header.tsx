function Header() {
  return (
    <div className="headerContainer">
      <div style={{ display: "flex" }}>
        <div className="svgCODALogo"></div>
        <div
          className="headerTitle"
          style={{ float: "left", marginLeft: "10px" }}
        >
          CODA
        </div>
      </div>
      <div style={{ float: "left" }}>
        <select name="EVAsDropdown" id="EVAsDropdown"></select>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          marginLeft: "30px",
          minHeight: "4em",
        }}
      >
        <div style={{ display: "grid", flexWrap: "wrap" }}>
          <div style={{ flexGrow: 1, fontSize: "0.8em", color: "#9b9b9b" }}>
            EVA Name:{" "}
            <span style={{ color: "white" }} id="evaNameSpan">
              EVA Name
            </span>
          </div>
          <div style={{ flexGrow: 1, fontSize: "0.8em", color: "#9b9b9b" }}>
            EVA Title:{" "}
            <span style={{ color: "white" }} id="evaTitleSpan">
              EVA Title
            </span>
          </div>
          <div style={{ flexGrow: 1, fontSize: "0.8em", color: "#9b9b9b" }}>
            EV1:{" "}
            <span style={{ color: "white" }} id="ev1TitleSpan">
              EV1
            </span>
          </div>
          <div style={{ flexGrow: 1, fontSize: "0.8em", color: "#9b9b9b" }}>
            EV2:{" "}
            <span style={{ color: "white" }} id="ev2TitleSpan">
              EV2
            </span>
          </div>
        </div>
        <div
          className="MissionDateTimeWrapper"
          id="MissionDateTimeWrapper"
          style={{
            display: "flex",
            marginLeft: "30px",
            float: "left",
            width: "550px",
          }}
        >
          <div style={{ flexGrow: 1, fontSize: "0.8em", color: "#9b9b9b" }}>
            EVA Date/GMT:
          </div>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              size={10}
              className="dateTime"
              id="missionDate"
              name="missionDate"
              value="2019-08-21"
            />
          </div>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              size={8}
              className="dateTime"
              id="missionTime"
              name="missionTime"
              value="00:00:00"
            />
          </div>
          <div style={{ flex: 2 }}>
            <a
              className="littleTopButton"
              id="goButton"
              title="Jump to Date/Time"
              // onClick={goButtonClick}
            >
              GO
            </a>
            <a
              className="littleTopButton"
              id="shareButton"
              title="Share"
              // onClick={shareButtonClick}
            >
              Share
            </a>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div className="svgNASALogo" style={{ float: "right" }} />
        <div
          style={{
            float: "right",
            textAlign: "right",
            fontSize: "0.8rem",
            marginRight: "10px",
          }}
        >
          Alpha v0.01
          <br />
          Contact:{" "}
          <a href="mailto:benjamin.f.feist@nasa.gov">
            benjamin.f.feist@nasa.gov
          </a>
        </div>
      </div>
    </div>
  );
}

export default Header;
