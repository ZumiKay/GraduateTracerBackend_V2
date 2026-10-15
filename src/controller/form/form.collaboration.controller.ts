import { Response } from "express";
import User from "../../model/User.model";
import { CustomRequest } from "../../types/customType";
import { ReturnCode } from "../../utilities/helper";
import { ensureFormAccess } from "../../utilities/formAccessGuard";
import { formCollaboration } from "../../services/FormCollaborationService";

const HEARTBEAT_MS = 30_000;

/**
 * SSE stream of who is in the form editor and which questions are locked.
 */
export async function SubscribeToFormCollaboration(
  req: CustomRequest,
  res: Response,
): Promise<void> {
  const formId = req.params.formId;
  if (!(await ensureFormAccess(req, res, formId))) return;

  const userId = req.user!.sub.toString();
  const account = await User.findById(userId).select("name email").lean();
  const name = account?.name || account?.email || "Collaborator";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable buffering in nginx
  res.flushHeaders?.();

  const connectionId = formCollaboration.addClient(
    formId,
    { userId, name },
    res,
  );

  const heartbeat = setInterval(() => {
    try {
      res.write(`:heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    formCollaboration.removeClient(formId, connectionId);
    res.end();
  });
}

function readLockBody(req: CustomRequest) {
  const { connectionId, questionId } = (req.body ?? {}) as {
    connectionId?: unknown;
    questionId?: unknown;
  };
  if (typeof connectionId !== "string" || typeof questionId !== "string") {
    return null;
  }
  if (!connectionId || !questionId) return null;
  return { connectionId, questionId };
}

/**
 * Take or refresh the editing lock on a question.
 * 409 with the current holder when someone else is editing it.
 */
export async function AcquireQuestionLock(req: CustomRequest, res: Response) {
  const formId = req.params.formId;
  if (!(await ensureFormAccess(req, res, formId))) return;

  const body = readLockBody(req);
  if (!body) {
    return res.status(400).json(ReturnCode(400, "Invalid request payload"));
  }

  const userId = req.user!.sub.toString();
  if (!formCollaboration.ownsConnection(formId, body.connectionId, userId)) {
    return res.status(403).json(ReturnCode(403, "Unknown connection"));
  }

  const result = formCollaboration.acquireLock(
    formId,
    body.connectionId,
    body.questionId,
  );

  if (!result.success) {
    return res.status(409).json({
      ...ReturnCode(409, "Someone else is editing this question"),
      data: result.lock,
    });
  }

  return res.status(200).json({ ...ReturnCode(200), data: result.lock });
}

/** Release the editing lock on a question. */
export async function ReleaseQuestionLock(req: CustomRequest, res: Response) {
  const formId = req.params.formId;
  if (!(await ensureFormAccess(req, res, formId))) return;

  const body = readLockBody(req);
  if (!body) {
    return res.status(400).json(ReturnCode(400, "Invalid request payload"));
  }

  const userId = req.user!.sub.toString();
  if (!formCollaboration.ownsConnection(formId, body.connectionId, userId)) {
    return res.status(403).json(ReturnCode(403, "Unknown connection"));
  }

  formCollaboration.releaseLock(formId, body.connectionId, body.questionId);
  return res.status(200).json(ReturnCode(200));
}
