import { Response } from "express";
import {
  expressProfilingStart,
  expressProfilingStop,
  expressProfilingUI,
  isProfiling,
  setProfilingTimeout,
} from "./onDemandProfiler";
import {
  expectClientLoggerToBeCalledTimes,
  expectServerLoggerToBeCalledTimes,
  LoggerSpies,
  resetLoggerSpies,
  setupLoggerSpies,
} from "./setupLoggerSpies";
import { EmssUser } from "@emss/oauth2-proxy-common";
import {
  ConsoleSpies,
  expectConsoleToBeCalledTimes,
  resetConsoleSpies,
  setupConsoleSpies,
} from "@emss/jest-mock-console";
import { asyncSleep } from "./asyncSleep";

let loggerSpies: LoggerSpies;
let consoleSpies: ConsoleSpies;

const makeFakeExpressResponse = () => {
  const fakeResponse = {} as unknown as Response;
  fakeResponse.send = jest.fn();
  fakeResponse.status = jest.fn(() => fakeResponse); // chained

  const sendSpy = jest.spyOn(fakeResponse, "send");
  const statusSpy = jest.spyOn(fakeResponse, "status");

  return { fakeResponse, sendSpy, statusSpy };
};

beforeEach(() => {
  loggerSpies = setupLoggerSpies();
  consoleSpies = setupConsoleSpies();
});

afterEach(() => {
  resetLoggerSpies(loggerSpies);
  resetConsoleSpies(consoleSpies);
});

it("should error when trying to stop profiling that is not started", async () => {
  const { fakeResponse, sendSpy, statusSpy } = makeFakeExpressResponse();

  await expressProfilingStop(fakeResponse, {
    auid: "logtestuser",
  } as EmssUser);

  expectConsoleToBeCalledTimes(consoleSpies, { error: 1 });
  expect(consoleSpies.error.mock.calls[0][0]).toEqual("No profiling in work");
  expect(sendSpy).toHaveBeenCalledTimes(1);
  expect(statusSpy).toHaveBeenCalledTimes(1);
  expect(statusSpy).toHaveBeenCalledWith(500);
});

it("should allow manual start and stop and prevent concurrent starts", async () => {
  const fake1 = makeFakeExpressResponse();

  const fakeUser = {
    auid: "logtestuser",
  } as EmssUser;

  /**
   * Start profiling
   */
  await expressProfilingStart(fake1.fakeResponse, fakeUser);

  expectServerLoggerToBeCalledTimes(loggerSpies.server, { notice: 1 });
  expect(loggerSpies.server.notice.mock.calls[0]).toEqual([
    {
      logId: "api-profile-start",
    },
    fakeUser,
  ]);

  expect(isProfiling()).toEqual(true);

  expect(fake1.sendSpy).toHaveBeenCalledTimes(1);
  expect(fake1.sendSpy).toHaveBeenCalledWith("Started profiling");
  expect(fake1.statusSpy).toHaveBeenCalledTimes(0);

  resetLoggerSpies(loggerSpies);
  loggerSpies = setupLoggerSpies();

  /**
   * Attempt to start profiling again, which fails
   */
  const fake2 = makeFakeExpressResponse();
  await expressProfilingStart(fake2.fakeResponse, fakeUser);
  expectConsoleToBeCalledTimes(consoleSpies, { error: 1 });
  expect(consoleSpies.error.mock.calls[0][0]).toEqual("Profiling already started");
  expectServerLoggerToBeCalledTimes(loggerSpies.server, "none");

  expect(fake2.statusSpy).toHaveBeenCalledTimes(1);
  expect(fake2.statusSpy).toHaveBeenCalledWith(500);
  expect(fake2.sendSpy).toHaveBeenCalledTimes(1);
  expect(fake2.sendSpy).toHaveBeenLastCalledWith("Profiling already started");
  expect(isProfiling()).toEqual(true);

  resetConsoleSpies(consoleSpies);
  consoleSpies = setupConsoleSpies();
  resetLoggerSpies(loggerSpies);
  loggerSpies = setupLoggerSpies();

  /**
   * Manually stop profiling
   */
  const fake3 = makeFakeExpressResponse();
  await expressProfilingStop(fake3.fakeResponse, fakeUser);

  expectConsoleToBeCalledTimes(consoleSpies, "none");
  expectServerLoggerToBeCalledTimes(loggerSpies.server, { notice: 1 });
  expect(loggerSpies.server.notice.mock.calls[0]).toEqual([
    { logId: "api-profile-stop" },
    fakeUser,
  ]);

  // profiling response should be long
  expect(fake3.sendSpy).toHaveBeenCalledTimes(1);
  expect(fake3.sendSpy.mock.calls[0][0].length > 100).toEqual(true);

  expect(fake3.statusSpy).toHaveBeenCalledTimes(0);

  // profiling has been stopped
  expect(isProfiling()).toEqual(false);
});

it("should automatically stop after timeout", async () => {
  const { fakeResponse, sendSpy, statusSpy } = makeFakeExpressResponse();

  const fakeUser = {
    auid: "logtestuser",
  } as EmssUser;

  setProfilingTimeout(500);

  await expressProfilingStart(fakeResponse, fakeUser);

  expectServerLoggerToBeCalledTimes(loggerSpies.server, { notice: 1 });
  expect(loggerSpies.server.notice.mock.calls[0]).toEqual([
    {
      logId: "api-profile-start",
    },
    fakeUser,
  ]);
  expectClientLoggerToBeCalledTimes(loggerSpies.client, "none");

  expect(isProfiling()).toEqual(true);

  expect(sendSpy).toHaveBeenCalledTimes(1);
  expect(sendSpy).toHaveBeenCalledWith("Started profiling");
  expect(statusSpy).toHaveBeenCalledTimes(0);

  sendSpy.mockClear();

  await asyncSleep(1000);

  expectServerLoggerToBeCalledTimes(loggerSpies.server, { notice: 2 });
  expect(loggerSpies.server.notice.mock.calls[1]).toEqual([{ logId: "api-profile-auto-stop" }]);

  expectConsoleToBeCalledTimes(consoleSpies, "none");
  expect(sendSpy).toHaveBeenCalledTimes(0);
  expect(statusSpy).toHaveBeenCalledTimes(0);

  // profiling automatically stopped
  expect(isProfiling()).toEqual(false);
}, 20000);

it("should have a UI endpoint", async () => {
  const { fakeResponse, sendSpy, statusSpy } = makeFakeExpressResponse();

  expressProfilingUI(fakeResponse);

  expectServerLoggerToBeCalledTimes(loggerSpies.server, "none");
  expectClientLoggerToBeCalledTimes(loggerSpies.client, "none");
  expect(sendSpy).toHaveBeenCalledTimes(1);
  expect(statusSpy).toHaveBeenCalledTimes(0);
  expectConsoleToBeCalledTimes(consoleSpies, "none");
});
