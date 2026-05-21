import { EntitySchema, types as MikroTypes } from "@mikro-orm/postgresql";

export class PcdAudio_db implements PcdAudioRecord {
  id!: number;
  source!: Source;
  notes?: string;
  audioJson!: PcdAudioJson;
}

export const PcdAudio_dbSchema = new EntitySchema<PcdAudio_db>({
  class: PcdAudio_db,
  tableName: "pcd_audio_db",
  properties: {
    id: { type: MikroTypes.integer, primary: true, autoincrement: true },
    source: { type: MikroTypes.text },
    notes: { type: MikroTypes.text, nullable: true },
    audioJson: { type: MikroTypes.json },
  },
});
