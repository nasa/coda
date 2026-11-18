import type { EmssUser } from "@emss/oauth2-proxy-common";
import type { Socket } from "socket.io";
import {
  getTalkybotData,
  getTalkybotSources,
  toTbAudioFileConverted,
} from "server/processing/talkybot";
import { isDataTypeValidForSourceAndDate } from "utils/sourceDataTypeMap";

type ViewerSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface TalkybotView {
  socket: ViewerSocket;
  user: EmssUser;
  source: Source;
  date: string;
  channelIds?: Set<number>;
  pending?: Map<string, TbAudioFileConverted | null>;
}

const views = new Map<string, TalkybotView>();

async function sendHistory(view: TalkybotView): Promise<void> {
  const { socket, user, source, date } = view;
  const liveFiles = new Map<string, TbAudioFileConverted | null>();
  view.pending = liveFiles;
  const { channelIds, response } = await getTalkybotData(source, date, user);
  if (views.get(socket.id) !== view) return;
  view.pending = undefined;
  const allowedChannels = new Set(channelIds);
  view.channelIds = allowedChannels;

  const files = new Map(response.data.map((file) => [file.fileUuid, file]));
  // A clip can arrive or be deleted while the history request is in flight.
  for (const [uuid, file] of liveFiles) {
    if (file) files.set(uuid, file);
    else files.delete(uuid);
  }
  const visibleFiles = [...files.values()].filter(
    (file) => file.override || allowedChannels.has(file.talkybotChannelId ?? -1)
  );
  socket.emit("dataUpdate", {
    type: "talkybot",
    response: { ...response, data: visibleFiles.sort((a, b) => +a.startTime - +b.startTime) },
  });
}

export function setTalkybotView(
  socket: ViewerSocket,
  user: EmssUser,
  { source, dateViewing: date }: Pick<VisitorData, "source" | "dateViewing">
): void {
  removeTalkybotView(socket.id);
  if (!isDataTypeValidForSourceAndDate(source, "talkybot", date)) return;
  const view = { socket, user, source, date };
  views.set(socket.id, view);
  void sendHistory(view);
}

export function removeTalkybotView(socketId: string): void {
  views.delete(socketId);
}

export function retryTalkybotHistory(socketId: string): void {
  const view = views.get(socketId);
  if (view && !view.pending) void sendHistory(view);
}

export function deliverTalkybotClip(payload: TbAudioFileNative): void {
  const file = toTbAudioFileConverted(payload);
  if (!Number.isFinite(+file.startTime)) return;
  const date = file.startTime.toISOString().slice(0, 10);
  const sources = getTalkybotSources(payload.channel);
  const channelId = payload.channel.id;

  for (const view of views.values()) {
    if (view.date !== date || !sources.includes(view.source)) continue;
    view.pending?.set(file.fileUuid, payload.deleted ? null : file);
    if (!view.channelIds?.has(channelId)) continue;
    if (payload.deleted) {
      view.socket.emit("talkybotClipRemoved", file.fileUuid);
    } else {
      view.socket.emit("incrementalDataUpdate", { type: "talkybot", item: file });
    }
  }
}
