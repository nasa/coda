export const allPresets: Preset[] = [
  {
    name: "Default CODA Display",
    layout: "j",
    frames: {
      1: {
        paneType: "video_downlink",
        paneStateData: {
          ready: true,
          downlink: 0,
          activeVideoFileID: "",
          muted: false,
          showInfo: false,
        } as VideoPaneStateData,
      },
      2: {
        paneType: "video_downlink",
        paneStateData: {
          ready: true,
          downlink: 1,
          activeVideoFileID: "",
          muted: true,
          showInfo: false,
        } as VideoPaneStateData,
      },
      3: {
        paneType: "photo",
        paneStateData: {
          ready: true,
          showInfo: false,
          showFilter: false,
        } as PhotoPaneStateData,
      },
      4: {
        paneType: "photo_all",
        paneStateData: {
          ready: true,
          showFilter: false,
          lockPhotosScroll: true,
        } as PhotoAllPaneStateData,
      },
      5: {
        paneType: "iss_location",
        paneStateData: {
          lockMap: true,
          ready: true,
        } as LocationPaneStateData,
      },
      6: {
        paneType: "event_info",
        paneStateData: {
          ready: true,
          showHelp: false,
        } as EventPaneStateData,
      },
    },
  },
  {
    name: "9-Pack Downlinks",
    layout: "f",
    frames: {
      1: {
        paneType: "video_downlink",
        paneStateData: {
          ready: true,
          downlink: 0,
          activeVideoFileID: "",
          muted: true,
          showInfo: false,
        } as VideoPaneStateData,
      },
      2: {
        paneType: "video_downlink",
        paneStateData: {
          ready: true,
          downlink: 1,
          activeVideoFileID: "",
          muted: true,
          showInfo: false,
        } as VideoPaneStateData,
      },
      3: {
        paneType: "video_downlink",
        paneStateData: {
          ready: true,
          downlink: 2,
          activeVideoFileID: "",
          muted: true,
          showInfo: false,
        } as VideoPaneStateData,
      },
      4: {
        paneType: "video_downlink",
        paneStateData: {
          ready: true,
          downlink: 3,
          activeVideoFileID: "",
          muted: true,
          showInfo: false,
        } as VideoPaneStateData,
      },
      5: {
        paneType: "video_downlink",
        paneStateData: {
          ready: true,
          downlink: 4,
          activeVideoFileID: "",
          muted: true,
          showInfo: false,
        } as VideoPaneStateData,
      },
      6: {
        paneType: "video_downlink",
        paneStateData: {
          ready: true,
          downlink: 5,
          activeVideoFileID: "",
          muted: true,
          showInfo: false,
        } as VideoPaneStateData,
      },
      7: {
        paneType: "video_downlink",
        paneStateData: {
          ready: true,
          downlink: 6,
          activeVideoFileID: "",
          muted: true,
          showInfo: false,
        } as VideoPaneStateData,
      },
      8: {
        paneType: "video_downlink",
        paneStateData: {
          ready: true,
          downlink: 7,
          activeVideoFileID: "",
          muted: true,
          showInfo: false,
        } as VideoPaneStateData,
      },
      9: {
        paneType: "photo",
        paneStateData: {
          ready: true,
          showInfo: false,
          showFilter: false,
        } as PhotoPaneStateData,
      },
    },
  },
];
