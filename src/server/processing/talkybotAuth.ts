import type { EmssUser } from "@emss/oauth2-proxy-common";

let channels: Map<number, TalkybotChannelAuthorization> | null = null;

export interface TalkybotPlayback {
  uuid: string;
  user: EmssUser;
  channelId?: number;
  controller: AbortController;
}

const playbacks = new Set<TalkybotPlayback>();

export function trackTalkybotPlayback(playback: TalkybotPlayback): () => void {
  playbacks.add(playback);
  return () => {
    playbacks.delete(playback);
  };
}

export function checkTalkybotClipPlayback(clip: TbAudioFileNative): void {
  for (const playback of playbacks) {
    if (
      playback.uuid === clip.uuid &&
      (clip.deleted ||
        !canAccessTalkybotChannel(playback.user, clip.channel.id) ||
        (playback.channelId !== undefined && playback.channelId !== clip.channel.id))
    ) {
      playback.controller.abort();
    }
  }
}

export function setTalkybotChannelAuthorization(
  snapshot: TalkybotChannelAuthorization[] | null
): void {
  channels = snapshot && new Map(snapshot.map((channel) => [channel.channelId, channel]));
  for (const { channelId, user, controller } of playbacks) {
    if (!channels || (channelId !== undefined && !canAccessTalkybotChannel(user, channelId)))
      controller.abort();
  }
}

export function hasTalkybotAuthorization(): boolean {
  return channels !== null;
}

function isSuperuser(user: EmssUser): boolean {
  const roles = typeof user.roles === "string" ? [user.roles] : (user.roles ?? []);
  return roles.includes("EMSS-Superuser");
}

function canAccess(
  channel: TalkybotChannelAuthorization,
  auid: string,
  superuser: boolean
): boolean {
  return superuser || (channel.enabled && (channel.public || channel.auids.includes(auid)));
}

export function canAccessTalkybotChannel(user: EmssUser, channelId: number): boolean {
  const channel = channels?.get(channelId);
  return !!(user.auid && channel && canAccess(channel, user.auid, isSuperuser(user)));
}

export function getTalkybotAllowedChannels(user: EmssUser): Set<number> {
  const allowed = new Set<number>();
  if (!user.auid || !channels) return allowed;
  const superuser = isSuperuser(user);
  for (const channel of channels.values()) {
    if (canAccess(channel, user.auid, superuser)) allowed.add(channel.channelId);
  }
  return allowed;
}
