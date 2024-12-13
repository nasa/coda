import express, { Request, Response } from "express";
import { getUser } from "packages/getUser";
import serverLogger from "utils/serverLogger";

const router = express.Router();

// get
router.get("/", async (req: Request, res: Response): Promise<void> => {
  res.setHeader("content-type", "application/json");
  const user = getUser(req);
  if (user instanceof Error) {
    const msg = "Unable to decode JWT";
    console.error(msg, user);
    res.status(500).send({ msg });
    return;
  }
  serverLogger.logUserLogin(user);
  res.send({ user });
});

export default router;

// TODO: currently unused but could be used to restrict access to API endpoints
export const allowAccess = (req: Request) => {
  const user = getUser(req);
  if (user instanceof Error) {
    const msg = "Unable to decode JWT";
    console.error(msg, user);
    return false; // auth error, don't allow
  }
  if (!user.usperson) {
    return false; // not a citizen or legal permanent resident, don't allow
  }
  // allow if from JSC in orgs beginning with C or X
  // return /\(JSC-[CX]/.test(user.display_name);

  // allow all others
  return true;
};
