import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TalkybotConnectionNotice from "./talkybotConnectionNotice";

const { state, dispatch } = vi.hoisted(() => ({
  state: {
    talkybot: {
      audioFiles: [],
      metadata: null,
      connectionError: null,
      retryCount: 0,
    } as TalkybotState,
  },
  dispatch: vi.fn(),
}));

vi.mock("utils/useAppSelector", () => ({
  refEqual: Object.is,
  useAppSelector: (selector: (value: typeof state) => unknown) => selector(state),
}));
vi.mock("utils/useAppDispatch", () => ({ useAppDispatch: () => dispatch }));

beforeEach(() => {
  vi.stubEnv("VITE_PUBLIC_TALKYBOT_URL", "https://talkybot.fit.nasa.gov");
  vi.stubGlobal("window", { location: { href: "https://coda-local.fit.nasa.gov:3000" } });
  state.talkybot.metadata = null;
  state.talkybot.connectionError = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Talkybot connection notice", () => {
  it("offers production sign-in and retry when transcript requests fail", () => {
    state.talkybot.metadata = { success: false, timestamp: "2026-10-28T00:00:00Z" };
    const html = renderToStaticMarkup(createElement(TalkybotConnectionNotice));
    expect(html).toContain('href="https://talkybot.fit.nasa.gov/login"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Sign in to Talkybot");
    expect(html).toContain("Retry connection");
  });

  it("offers recovery if live updates fail after transcripts load", () => {
    state.talkybot.metadata = { success: true, timestamp: "2026-10-28T00:00:00Z" };
    state.talkybot.connectionError = "Talkybot live updates are unavailable.";
    const html = renderToStaticMarkup(createElement(TalkybotConnectionNotice));
    expect(html).toContain(state.talkybot.connectionError);
    expect(html).toContain("Retry connection");
  });

  it("does not ask users to sign in just because an authenticated date is empty", () => {
    state.talkybot.metadata = { success: true, timestamp: "2026-10-28T00:00:00Z" };
    expect(renderToStaticMarkup(createElement(TalkybotConnectionNotice))).toBe("");
  });

  it("explains HTTP setup rather than offering a login that cannot fix it", () => {
    vi.stubGlobal("window", { location: { href: "http://coda-local.fit.nasa.gov:3000" } });
    const html = renderToStaticMarkup(createElement(TalkybotConnectionNotice));
    expect(html).toContain("HTTPS");
    expect(html).not.toContain("Sign in to Talkybot");
  });
});
