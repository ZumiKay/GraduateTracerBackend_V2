"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formCollaboration = exports.FormCollaborationManager = exports.LOCK_TTL_MS = void 0;
const crypto_1 = require("crypto");
/**
 * Live collaboration state for the form editor: who has a form open
 * (presence) and which question each person is editing (soft locks).
 *
 * State is kept in memory */
// A lock disappears if its holder stops refreshing it for this long
exports.LOCK_TTL_MS = 30_000;
const SWEEP_INTERVAL_MS = 5_000;
class FormCollaborationManager {
    rooms = new Map();
    sweepTimer = null;
    /** Registers an open editor tab and tells everyone in the form. */
    addClient(formId, user, stream) {
        const room = this.getOrCreateRoom(formId);
        const connectionId = (0, crypto_1.randomUUID)();
        room.clients.set(connectionId, { ...user, connectionId, stream });
        this.send(stream, { type: "connected", connectionId });
        this.broadcast(formId);
        this.startSweep();
        return connectionId;
    }
    /** Removes a tab, releases every lock it held and tells everyone. */
    removeClient(formId, connectionId) {
        const room = this.rooms.get(formId);
        if (!room)
            return;
        room.clients.delete(connectionId);
        for (const [questionId, lock] of room.locks) {
            if (lock.connectionId === connectionId)
                room.locks.delete(questionId);
        }
        if (room.clients.size === 0) {
            this.rooms.delete(formId);
            if (this.rooms.size === 0)
                this.stopSweep();
            return;
        }
        this.broadcast(formId);
    }
    /** True when the connection is open on this form and belongs to the user. */
    ownsConnection(formId, connectionId, userId) {
        return this.rooms.get(formId)?.clients.get(connectionId)?.userId === userId;
    }
    /**
     * Takes or refreshes the lock on a question.
     * Fails when another connection holds an unexpired lock on it.
     */
    acquireLock(formId, connectionId, questionId, now = Date.now()) {
        const room = this.rooms.get(formId);
        const client = room?.clients.get(connectionId);
        if (!room || !client)
            return { success: false };
        const existing = room.locks.get(questionId);
        const heldByOther = existing && existing.connectionId !== connectionId && existing.expiresAt > now;
        if (heldByOther) {
            return { success: false, lock: this.toPublicLock(existing) };
        }
        const isRefresh = existing?.connectionId === connectionId;
        const lock = {
            questionId,
            connectionId,
            userId: client.userId,
            name: client.name,
            expiresAt: now + exports.LOCK_TTL_MS,
        };
        room.locks.set(questionId, lock);
        // A refresh changes nothing others can see
        if (!isRefresh)
            this.broadcast(formId);
        return { success: true, lock: this.toPublicLock(lock) };
    }
    /** Releases a lock if this connection holds it. */
    releaseLock(formId, connectionId, questionId) {
        const room = this.rooms.get(formId);
        const existing = room?.locks.get(questionId);
        if (!room || existing?.connectionId !== connectionId)
            return;
        room.locks.delete(questionId);
        this.broadcast(formId);
    }
    /**
     * Pushes a page's newly saved content to everyone else in the form.
     * `senderConnectionId` (the tab that made the save) is skipped: it already
     * has the result from its own request.
     */
    broadcastContent(formId, update, sender) {
        const room = this.rooms.get(formId);
        if (!room)
            return;
        // Only trust the connection id when it really is this user's
        const senderClient = sender.connectionId ? room.clients.get(sender.connectionId) : undefined;
        const ownSender = senderClient?.userId === sender.userId ? senderClient : undefined;
        const name = ownSender?.name ??
            Array.from(room.clients.values()).find((c) => c.userId === sender.userId)?.name ??
            "A collaborator";
        const message = {
            type: "content",
            ...update,
            by: { userId: sender.userId, name },
        };
        for (const client of room.clients.values()) {
            if (ownSender && client.connectionId === ownSender.connectionId)
                continue;
            this.send(client.stream, message);
        }
    }
    /**
     * Tells everyone else that the form's pages were added or removed, so the
     * page they are looking at may no longer be the page they think it is.
     */
    broadcastStructureChange(formId, sender) {
        const room = this.rooms.get(formId);
        if (!room)
            return;
        const senderClient = sender.connectionId ? room.clients.get(sender.connectionId) : undefined;
        const skip = senderClient?.userId === sender.userId ? sender.connectionId : undefined;
        for (const client of room.clients.values()) {
            if (client.connectionId === skip)
                continue;
            this.send(client.stream, { type: "structure" });
        }
    }
    /** Drops locks whose holder stopped refreshing them. */
    sweepExpired(now = Date.now()) {
        for (const [formId, room] of this.rooms) {
            let changed = false;
            for (const [questionId, lock] of room.locks) {
                if (lock.expiresAt <= now) {
                    room.locks.delete(questionId);
                    changed = true;
                }
            }
            if (changed)
                this.broadcast(formId);
        }
    }
    getState(formId) {
        const room = this.rooms.get(formId);
        return {
            type: "state",
            users: room
                ? Array.from(room.clients.values()).map(({ connectionId, userId, name }) => ({
                    connectionId,
                    userId,
                    name,
                }))
                : [],
            locks: room ? Array.from(room.locks.values()).map((l) => this.toPublicLock(l)) : [],
        };
    }
    toPublicLock(lock) {
        const { questionId, connectionId, userId, name } = lock;
        return { questionId, connectionId, userId, name };
    }
    getOrCreateRoom(formId) {
        let room = this.rooms.get(formId);
        if (!room) {
            room = { clients: new Map(), locks: new Map() };
            this.rooms.set(formId, room);
        }
        return room;
    }
    broadcast(formId) {
        const room = this.rooms.get(formId);
        if (!room)
            return;
        const state = this.getState(formId);
        for (const client of room.clients.values()) {
            this.send(client.stream, state);
        }
    }
    send(stream, data) {
        try {
            stream.write(`data: ${JSON.stringify(data)}\n\n`);
        }
        catch (error) {
            console.error("[Collab] Failed to write to stream:", error);
        }
    }
    startSweep() {
        if (this.sweepTimer)
            return;
        this.sweepTimer = setInterval(() => this.sweepExpired(), SWEEP_INTERVAL_MS);
        // Never keep the process (or a test run) alive just for the sweep
        this.sweepTimer.unref?.();
    }
    stopSweep() {
        if (!this.sweepTimer)
            return;
        clearInterval(this.sweepTimer);
        this.sweepTimer = null;
    }
}
exports.FormCollaborationManager = FormCollaborationManager;
exports.formCollaboration = new FormCollaborationManager();
