import express, { Request, Response } from "express";
import { requireSuperuser } from "server/express/middleware/requireSuperuser";
import ConsoleLogger from "utils/logging/consoleLogger";
import { globalValues, getSocketIO } from "server/express/global";
import { emitVisitorInspectorUpdate } from "server/express/sockets";

/**
 * `/api/v1/emss/liveVideoToggle`
 *
 * Toggle live video restriction for a specific socket session
 */

const router = express.Router();

interface VideoToggleRequestBody {
  targetSocketId: string;
  disabled: boolean;
}

// POST - toggle live video restriction
router.post("/", requireSuperuser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetSocketId, disabled } = req.body as VideoToggleRequestBody;

    if (!targetSocketId || typeof disabled !== "boolean") {
      res.status(400).json({
        status: "error",
        message: "Missing required parameters: targetSocketId and disabled (boolean)",
      });
      return;
    }

    // Find the visitor and update their liveVideoEnabled property
    const visitor = globalValues.serverSocketStatus.visitorsData.find(
      (v) => v.socketId === targetSocketId
    );

    if (!visitor) {
      res.status(404).json({
        status: "error",
        message: `Socket ${targetSocketId} not found`,
      });
      return;
    }

    visitor.liveVideoEnabled = !disabled;

    // Get socket.io instance and emit the restriction update directly to the target client
    const io = getSocketIO();
    if (io) {
      io.to(targetSocketId).emit("liveVideoRestrictionUpdate", { disabled });

      // Emit updated visitor inspector to admins
      emitVisitorInspectorUpdate();
    }

    ConsoleLogger.debug(
      `API - videoToggle: ${disabled ? "Disabled" : "Enabled"} live video for socket ${targetSocketId}`
    );

    res.status(200).json({
      status: "success",
      message: `Live video ${disabled ? "disabled" : "enabled"} for socket ${targetSocketId}`,
      data: { targetSocketId, disabled },
    });
  } catch (e) {
    ConsoleLogger.error("Error in videoToggle route:", e);
    res.status(500).json({
      status: "error",
      message: `Error processing the POST request: ${e}`,
    });
  }
});

export default router;
