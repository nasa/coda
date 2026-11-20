import type { EmssUser } from "@emss/oauth2-proxy-common";
import type { Socket } from "socket.io";
import {
  getTalkybotData,
  getTalkybotSources,
  toTbAudioFileConverted,
} from "server/processing/talkybot";
import {
  getTalkybotAllowedChannels,
  hasTalkybotAuthorization,
} from "server/processing/talkybotAuth";
import { isDataTypeValidForSourceAndDate } from "utils/sourceDataTypeMap";

type ViewerSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface TalkybotView {
  socket: ViewerSocket;
  user: EmssUser;
  source: Source;
  date: string;
  channelIds: Set<number>;
  authorized: boolean;
  shown: Map<string, number>;
  pending?: Map<string, TbAudioFileConverted | null>;
}

const views = new Map<string, TalkybotView>();

async function sendHistory(view: TalkybotView): Promise<void> {
  const { socket, source, date } = view;
  const liveFiles = new Map(view.pending);
  view.pending = liveFiles;
  const response = await getTalkybotData(source, date, view.authorized ? view.channelIds : null);
  if (views.get(socket.id) !== view || view.pending !== liveFiles) return;
  view.pending = undefined;

  const files = new Map(response.data.map((file) => [file.fileUuid, file]));
  // A clip can arrive or be deleted while the history request is in flight.
  for (const [uuid, file] of liveFiles) {
    if (file) files.set(uuid, file);
    else files.delete(uuid);
  }
  const visibleFiles = [...files.values()].filter(
    (file) => file.override || view.channelIds.has(file.talkybotChannelId ?? -1)
  );
  view.shown.clear();
  for (const file of visibleFiles) {
    if (file.talkybotChannelId !== undefined) view.shown.set(file.fileUuid, file.talkybotChannelId);
  }
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
  const view: TalkybotView = {
    socket,
    user,
    source,
    date,
    channelIds: getTalkybotAllowedChannels(user),
    authorized: hasTalkybotAuthorization(),
    shown: new Map(),
  };
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

export function refreshTalkybotViews(): void {
  const authorized = hasTalkybotAuthorization();
  for (const view of views.values()) {
    const channels = getTalkybotAllowedChannels(view.user);
    const needsHistory =
      authorized !== view.authorized || [...channels].some((id) => !view.channelIds.has(id));
    view.authorized = authorized;
    view.channelIds = channels;
    for (const [uuid, channelId] of view.shown) {
      if (channels.has(channelId)) continue;
      view.shown.delete(uuid);
      view.socket.emit("talkybotClipRemoved", uuid);
    }
    if (needsHistory) void sendHistory(view);
  }
}

export function deliverTalkybotClip(payload: TbAudioFileNative): void {
  const file = toTbAudioFileConverted(payload);
  if (!Number.isFinite(+file.startTime)) return;
  const date = file.startTime.toISOString().slice(0, 10);
  const sources = getTalkybotSources(payload.channel);
  const channelId = payload.channel.id;

  for (const view of views.values()) {
    const matches = view.date === date && sources.includes(view.source) && !payload.deleted;
    view.pending?.set(file.fileUuid, matches ? file : null);
    if (matches && view.channelIds.has(channelId)) {
      view.shown.set(file.fileUuid, channelId);
      view.socket.emit("incrementalDataUpdate", { type: "talkybot", item: file });
    } else if (view.shown.delete(file.fileUuid)) {
      view.socket.emit("talkybotClipRemoved", file.fileUuid);
    }
  }
}
