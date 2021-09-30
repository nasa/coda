/** Represents a single video search result as received from IO */
export interface Doc {
  audio_file_restricted: 0 | 1 | number;
  hh: 0 | 1 | number;
  duration_seconds: number;
  on_public_site: number;
  tw: number;
  md_online_01: number;
  on_flickr: 0 | 1 | number;
  lw: number;
  hw: number;
  /** Title of the EVA, eg. `US EVA 55` */
  md_title?: string;
  description?: string;
  md_orbit_ground: number;
  has_audio_file: 0 | 1 | number;
  asset_type: number;
  /** eg. `mp4` - just the extension, no leading dot */
  file_extension_video: string;
  /** eg. `iss060m532` */
  nasa_prefix?: string;
  /**
   * eg. `iss060m532331624`. There is an exception for video recorded during LOS
   * Breakdown:
   * ```md
   * iss  = ISS video
   * 053  = Expedition 53
   * m    = moving imagery e.g. video
   * 53   = Downlink 3, downlinked after an LOS. Realtime downlink would be 03
   * 278  = GMT day 278
   * 1939 = Actual start time of the video
   * ```
   *
   * Note that 19:39 is the actual GMT start time of this video for a non-realtime
   * downlink. The "Start GMT" listed in IO is wrong, stating GMT 0600.
   * */
  nasa_id: string;
  /** eg. `/photos/vrps/12674` */
  webpath: string;
  id: number;
  metadata_template: number;
  /** The suffix is found at the end of .nasa_id, eg. `331624` */
  nasa_suffix?: number;
  /** eg. `jpg` - just the extension, no leading dot */
  file_extension_lores: string;
  /** eg. `["P2344036/ISS Missions|ISS-060|Video|US Downlink|Channel 03"]` */
  collections_string: string[];
  avg_rating: number;
  collections: (string | number)[];
  file_extension_thum: string;
  /** UTC eg. `2019-08-21T14:47:22Z` */
  date_added: string;
  flickr_photo_id: number;
  th: number;
  collections_list: (string | number)[];
  /** UTC eg. `2019-08-21T17:11:12Z` */
  md_creation_date: string;
  /** Only created if start time has been modified in IO - UTC eg. `2019-08-21T17:11:12Z` */
  vmd_start_gmt?: string;
  lh: number;
  md_interior_exterior: number;
  _version_: number;
}
