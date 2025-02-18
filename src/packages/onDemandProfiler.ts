import { Response } from "express";
import * as inspector from "node:inspector/promises";
import { EmssUser } from "@emss/oauth2-proxy-common";
import { asError } from "@emss/utils";
import serverLogger from "utils/serverLogger";

let session: inspector.Session | undefined;
let profilingTimeoutId: NodeJS.Timeout;
let profilingTimeout = 30000;

export const isProfiling = (): boolean => {
  return Boolean(session);
};

export const setProfilingTimeout = (millis: number): void => {
  profilingTimeout = millis;
};

const stopProfiling = async (user?: EmssUser): Promise<string | { errorMessage: string }> => {
  // No profiling in process. Do nothing.
  if (!session) {
    const msg = "No profiling in work";
    console.error(msg);
    return { errorMessage: msg };
  }

  if (user) {
    serverLogger.notice({ logId: "api-profile-stop" }, user);
  } else {
    serverLogger.notice({ logId: "api-profile-auto-stop" });
  }

  try {
    const { profile } = await session.post("Profiler.stop");
    return JSON.stringify(profile);
  } catch (error) {
    const msg = "Failed to stop CPU profiling";
    serverLogger.error(asError(error), { logId: msg });
    console.error(msg + ":", error);
    return { errorMessage: msg };
  } finally {
    session.disconnect();
    session = undefined;
  }
};

export const expressProfilingStart = async (res: Response, user: EmssUser): Promise<void> => {
  // Don't allow more than one profiling session at once
  if (session) {
    const msg = "Profiling already started";
    console.error(msg);
    res.status(500).send(msg);
    return;
  }

  serverLogger.notice({ logId: "api-profile-start" }, user);

  session = new inspector.Session();

  try {
    session.connect();
    await session.post("Profiler.enable");
  } catch (error) {
    const msg = "Error enabling profiling";
    console.error(msg + ":", error);
    res.status(500).send(msg);
    return;
  }

  try {
    await session.post("Profiler.start");
  } catch (error) {
    const msg = "Error starting CPU profiling";
    console.error(msg + ":", error);
    res.status(500).send(msg);
    return;
  }

  // don't allow profiling to go longer than `profilingTimeout` (default 30
  // seconds)
  profilingTimeoutId = setTimeout(() => {
    stopProfiling();
  }, profilingTimeout);

  res.send("Started profiling");
};

export const expressProfilingStop = async (res: Response, user: EmssUser): Promise<void> => {
  if (session && profilingTimeoutId) {
    clearTimeout(profilingTimeoutId);
  }

  const result = await stopProfiling(user);
  if (typeof result !== "string") {
    res.status(500).send(result.errorMessage);
    return;
  }
  res.send(result);
};

export const expressProfilingUI = (res: Response): void => {
  res.send(
    `<!doctype html>
		<html lang="en">
		<body>
			<button id='start'>Start Profiling</button>
			<button id='stop' style='display: none;'>Stop Profiling</button>
			<button id='download' style='display: none;'>Download Profile</button>
			<pre id='result'></pre>
			<script>
				document.querySelector('#start').onclick = async () => {
					try {
						const response = await fetch("/api/v1/profile/start", { method: "POST" });
						document.querySelector('#start').style.display = 'none';
						document.querySelector('#stop').style.display = '';
						document.querySelector('#result').innerText = '';
						document.querySelector('#download').style.display = 'none';
					} catch (err) {
						alert('Failed to start profiling, error was: ' + err);
					}
				};

				document.querySelector('#stop').onclick = async () => {
					try {
						const response = await fetch("/api/v1/profile/stop", { method: "POST" });
						document.querySelector('#start').style.display = '';
						document.querySelector('#stop').style.display = 'none';
						const json = await response.json();
						document.querySelector('#result').innerText = JSON.stringify(json, null, 2);
						document.querySelector('#download').style.display = '';
					} catch (err) {
						alert('Failed to stop profiling, error was: ' + err);
					}
				};

				document.querySelector('#download').onclick = () => {
					const data = document.querySelector('#result').innerText;
					if (!data) {
						return;
					}

					const file = new Blob([data], { type: 'application/json' });
					const a = document.createElement("a");
					const url = URL.createObjectURL(file);

					a.href = url;
					a.download = 'api.cpuprofile';
					document.body.appendChild(a);
					a.click();
					setTimeout(function() {
						document.body.removeChild(a);
						window.URL.revokeObjectURL(url);  
					}, 0); 
				}
			</script>
		</body>`
  );
};
