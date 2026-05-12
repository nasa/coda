import { ConsoleLogger } from "../../utils/logging/consoleLogger";

/**
 * Cached snapshot of talkybot channel-access state, populated by the S2S socket.
 *
 * Talkybot pushes a `channelAccessSnapshot` event on connect and a `channelAccessUpdate`
 * event after every admin mutation that affects channel access. CODA caches the latest
 * snapshot here and uses `userCanSeeChannel` to filter audio per-visitor before fan-out.
 */

export interface ChannelAccessSnapshotChannel {
  slug: string;
  name: string;
  enabled: boolean;
  public: boolean;
  groups: string[];
  auids: string[];
}

export interface ChannelAccessSnapshot {
  version: number;
  generatedAt: string;
  channels: ChannelAccessSnapshotChannel[];
  superuserRoles: string[];
}

let snapshot: ChannelAccessSnapshot | null = null;
// Indexed view for O(1) lookup, kept in sync with `snapshot`.
let channelsBySlug: Map<string, ChannelAccessSnapshotChannel> = new Map();

/**
 * Replace the cached snapshot. Returns the channel slugs that were removed or had a
 * given user's access revoked since the previous snapshot — caller can use this to
 * notify affected visitors via `channelRevoked`.
 */
export const setChannelAccessSnapshot = (
  next: ChannelAccessSnapshot
): { previous: ChannelAccessSnapshot | null } => {
  const previous = snapshot;
  snapshot = next;
  channelsBySlug = new Map(next.channels.map((c) => [c.slug, c]));
  ConsoleLogger.debug(
    `channelAccessSnapshot: applied v${next.version} (${next.channels.length} channels) generated at ${next.generatedAt}`
  );
  return { previous };
};

export const getChannelAccessSnapshot = (): ChannelAccessSnapshot | null => snapshot;

/**
 * Returns true if the named channel is non-public per the cached snapshot. Used to
 * stamp `restricted` on outgoing audio files so the client can render a lock icon.
 * Returns false if no snapshot has been received or the channel is unknown — fail-open
 * for the indicator (better to omit a lock than to falsely mark a public channel).
 */
export const isChannelRestricted = (channelSlug: string): boolean => {
  const channel = channelsBySlug.get(channelSlug);
  if (!channel) return false;
  return !channel.public;
};

/**
 * Mirror of talkybot's user-facing channel access check
 * (apps/server/sockets.ts in talky-bot):
 *  - Superuser (per snapshot.superuserRoles): see all channels regardless of public/enabled
 *  - Otherwise channel must be enabled AND (public OR user.auid is in channel.auids)
 *
 * Returns false if no snapshot has been received yet — fail-closed.
 */
export const userCanSeeChannel = (
  user: { auid?: string; roles?: string | string[] | null } | null | undefined,
  channelSlug: string
): boolean => {
  if (!snapshot) return false;
  const channel = channelsBySlug.get(channelSlug);
  if (!channel) return false;

  const userRoles = !user?.roles ? [] : Array.isArray(user.roles) ? user.roles : [user.roles];

  const isSuperuser = snapshot.superuserRoles.some((role) => userRoles.includes(role));
  if (isSuperuser) return true;

  if (!channel.enabled) return false;
  if (channel.public) return true;
  return Boolean(user?.auid) && channel.auids.includes(user!.auid!);
};
