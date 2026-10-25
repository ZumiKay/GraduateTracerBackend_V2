"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscribeToFormCollaboration = SubscribeToFormCollaboration;
exports.AcquireQuestionLock = AcquireQuestionLock;
exports.ReleaseQuestionLock = ReleaseQuestionLock;
const User_model_1 = __importDefault(require("../../model/User.model"));
const helper_1 = require("../../utilities/helper");
const formAccessGuard_1 = require("../../utilities/formAccessGuard");
const FormCollaborationService_1 = require("../../services/FormCollaborationService");
//Interval to keep the connection alive,
const HEARTBEAT_MS = 30_000;
/**
 * SSE stream of who is in the form editor and which questions are locked.
 */
async function SubscribeToFormCollaboration(req, res) {
    const formId = req.params.formId;
    if (!(await (0, formAccessGuard_1.ensureFormAccess)(req, res, formId)))
        return;
    const userId = req.user.sub.toString();
    const account = await User_model_1.default.findById(userId).select("name email").lean();
    const name = account?.name || account?.email || "Collaborator";
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable buffering in nginx
    res.flushHeaders?.();
    const connectionId = FormCollaborationService_1.formCollaboration.addClient(formId, { userId, name }, res);
    const heartbeat = setInterval(() => {
        try {
            res.write(`:heartbeat\n\n`);
        }
        catch {
            clearInterval(heartbeat);
        }
    }, HEARTBEAT_MS);
    req.on("close", () => {
        clearInterval(heartbeat);
        FormCollaborationService_1.formCollaboration.removeClient(formId, connectionId);
        res.end();
    });
}
function readLockBody(req) {
    const { connectionId, questionId } = (req.body ?? {});
    if (typeof connectionId !== "string" || typeof questionId !== "string") {
        return null;
    }
    if (!connectionId || !questionId)
        return null;
    return { connectionId, questionId };
}
/**
 * Take or refresh the editing lock on a question.
 * 409 with the current holder when someone else is editing it.
 */
async function AcquireQuestionLock(req, res) {
    const formId = req.params.formId;
    if (!(await (0, formAccessGuard_1.ensureFormAccess)(req, res, formId)))
        return;
    const body = readLockBody(req);
    if (!body) {
        return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid request payload"));
    }
    const userId = req.user.sub.toString();
    if (!FormCollaborationService_1.formCollaboration.ownsConnection(formId, body.connectionId, userId)) {
        return res.status(403).json((0, helper_1.ReturnCode)(403, "Unknown connection"));
    }
    const result = FormCollaborationService_1.formCollaboration.acquireLock(formId, body.connectionId, body.questionId);
    if (!result.success) {
        return res.status(409).json({
            ...(0, helper_1.ReturnCode)(409, "Someone else is editing this question"),
            data: result.lock,
        });
    }
    return res.status(200).json({ ...(0, helper_1.ReturnCode)(200), data: result.lock });
}
/** Release the editing lock on a question. */
async function ReleaseQuestionLock(req, res) {
    const formId = req.params.formId;
    if (!(await (0, formAccessGuard_1.ensureFormAccess)(req, res, formId)))
        return;
    const body = readLockBody(req);
    if (!body) {
        return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid request payload"));
    }
    const userId = req.user.sub.toString();
    if (!FormCollaborationService_1.formCollaboration.ownsConnection(formId, body.connectionId, userId)) {
        return res.status(403).json((0, helper_1.ReturnCode)(403, "Unknown connection"));
    }
    FormCollaborationService_1.formCollaboration.releaseLock(formId, body.connectionId, body.questionId);
    return res.status(200).json((0, helper_1.ReturnCode)(200));
}
