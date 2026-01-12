import { EntitySchema, types as MikroTypes } from "@mikro-orm/postgresql";

export class VideoStartTimeOverrides_db implements VideoRecord {
  id!: number;
  videoId!: string;
  startTime!: string;
}

export const VideoStartTimeOverrides_dbSchema = new EntitySchema<VideoStartTimeOverrides_db>({
  class: VideoStartTimeOverrides_db,
  tableName: "video_start_time_overrides_db",
  properties: {
    id: { type: MikroTypes.integer, primary: true, autoincrement: true },
    videoId: { type: MikroTypes.string },
    startTime: { type: MikroTypes.string },
  },
});
