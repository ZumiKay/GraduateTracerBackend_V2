"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FormCollaborationService_1 = require("../FormCollaborationService");
const makeStream = () => {
    const messages = [];
    return {
        messages,
        write: (chunk) => {
            messages.push(JSON.parse(chunk.replace(/^data: /, "").trim()));
        },
        last: () => messages[messages.length - 1],
    };
};
describe("FormCollaborationManager", () => {
    const formId = "form-1";
    let manager;
    beforeEach(() => {
        jest.useFakeTimers();
        manager = new FormCollaborationService_1.FormCollaborationManager();
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    test("tells a new client its connection id and broadcasts presence to everyone", () => {
        const alice = makeStream();
        const bob = makeStream();
        const aliceConn = manager.addClient(formId, { userId: "u1", name: "Alice" }, alice);
        const bobConn = manager.addClient(formId, { userId: "u2", name: "Bob" }, bob);
        expect(alice.messages[0]).toEqual({ type: "connected", connectionId: aliceConn });
        expect(alice.last().users.map((u) => u.name)).toEqual(["Alice", "Bob"]);
        expect(bob.last().users.map((u) => u.connectionId)).toEqual([aliceConn, bobConn]);
    });
    test("keeps forms separate", () => {
        const alice = makeStream();
        const carol = makeStream();
        manager.addClient(formId, { userId: "u1", name: "Alice" }, alice);
        manager.addClient("form-2", { userId: "u3", name: "Carol" }, carol);
        expect(alice.last().users).toHaveLength(1);
        expect(manager.getState("form-2").users[0].name).toBe("Carol");
    });
    test("a lock blocks other connections until released", () => {
        const alice = makeStream();
        const bob = makeStream();
        const aliceConn = manager.addClient(formId, { userId: "u1", name: "Alice" }, alice);
        const bobConn = manager.addClient(formId, { userId: "u2", name: "Bob" }, bob);
        expect(manager.acquireLock(formId, aliceConn, "q1").success).toBe(true);
        expect(bob.last().locks).toEqual([
            { questionId: "q1", connectionId: aliceConn, userId: "u1", name: "Alice" },
        ]);
        const blocked = manager.acquireLock(formId, bobConn, "q1");
        expect(blocked.success).toBe(false);
        expect(blocked.lock?.name).toBe("Alice");
        // A different question is free
        expect(manager.acquireLock(formId, bobConn, "q2").success).toBe(true);
        manager.releaseLock(formId, aliceConn, "q1");
        expect(manager.acquireLock(formId, bobConn, "q1").success).toBe(true);
    });
    test("only the holder can release a lock", () => {
        const aliceConn = manager.addClient(formId, { userId: "u1", name: "Alice" }, makeStream());
        const bobConn = manager.addClient(formId, { userId: "u2", name: "Bob" }, makeStream());
        manager.acquireLock(formId, aliceConn, "q1");
        manager.releaseLock(formId, bobConn, "q1");
        expect(manager.getState(formId).locks).toHaveLength(1);
    });
    test("refreshing keeps a lock alive; an unrefreshed lock expires", () => {
        const bob = makeStream();
        const aliceConn = manager.addClient(formId, { userId: "u1", name: "Alice" }, makeStream());
        const bobConn = manager.addClient(formId, { userId: "u2", name: "Bob" }, bob);
        const start = 1_000_000;
        manager.acquireLock(formId, aliceConn, "q1", start);
        manager.acquireLock(formId, aliceConn, "q1", start + FormCollaborationService_1.LOCK_TTL_MS - 1); // refresh
        manager.sweepExpired(start + FormCollaborationService_1.LOCK_TTL_MS + 1);
        expect(manager.getState(formId).locks).toHaveLength(1);
        manager.sweepExpired(start + 2 * FormCollaborationService_1.LOCK_TTL_MS);
        expect(manager.getState(formId).locks).toHaveLength(0);
        expect(bob.last().locks).toEqual([]);
        expect(manager.acquireLock(formId, bobConn, "q1").success).toBe(true);
    });
    test("an expired lock can be taken over even before the sweep runs", () => {
        const aliceConn = manager.addClient(formId, { userId: "u1", name: "Alice" }, makeStream());
        const bobConn = manager.addClient(formId, { userId: "u2", name: "Bob" }, makeStream());
        const start = 1_000_000;
        manager.acquireLock(formId, aliceConn, "q1", start);
        expect(manager.acquireLock(formId, bobConn, "q1", start + FormCollaborationService_1.LOCK_TTL_MS + 1).success).toBe(true);
    });
    test("disconnecting releases the client's locks and updates presence", () => {
        const bob = makeStream();
        const aliceConn = manager.addClient(formId, { userId: "u1", name: "Alice" }, makeStream());
        manager.addClient(formId, { userId: "u2", name: "Bob" }, bob);
        manager.acquireLock(formId, aliceConn, "q1");
        manager.removeClient(formId, aliceConn);
        expect(bob.last().users.map((u) => u.name)).toEqual(["Bob"]);
        expect(bob.last().locks).toEqual([]);
    });
    test("ownsConnection checks both the form and the user", () => {
        const aliceConn = manager.addClient(formId, { userId: "u1", name: "Alice" }, makeStream());
        expect(manager.ownsConnection(formId, aliceConn, "u1")).toBe(true);
        expect(manager.ownsConnection(formId, aliceConn, "u2")).toBe(false);
        expect(manager.ownsConnection("form-2", aliceConn, "u1")).toBe(false);
        expect(manager.acquireLock("form-2", aliceConn, "q1").success).toBe(false);
    });
    describe("live content refresh", () => {
        const update = { page: 1, version: 4, data: [{ _id: "q1" }] };
        test("pushes saved content to everyone except the tab that saved it", () => {
            const alice = makeStream();
            const aliceOtherTab = makeStream();
            const bob = makeStream();
            const aliceConn = manager.addClient(formId, { userId: "u1", name: "Alice" }, alice);
            manager.addClient(formId, { userId: "u1", name: "Alice" }, aliceOtherTab);
            manager.addClient(formId, { userId: "u2", name: "Bob" }, bob);
            const aliceCount = alice.messages.length;
            manager.broadcastContent(formId, update, { userId: "u1", connectionId: aliceConn });
            const expected = { type: "content", ...update, by: { userId: "u1", name: "Alice" } };
            expect(bob.last()).toEqual(expected);
            expect(aliceOtherTab.last()).toEqual(expected);
            expect(alice.messages).toHaveLength(aliceCount);
        });
        test("ignores a connection id that belongs to someone else", () => {
            const alice = makeStream();
            const bob = makeStream();
            manager.addClient(formId, { userId: "u1", name: "Alice" }, alice);
            const bobConn = manager.addClient(formId, { userId: "u2", name: "Bob" }, bob);
            // Alice claims Bob's connection: Bob must still receive the update
            manager.broadcastContent(formId, update, { userId: "u1", connectionId: bobConn });
            expect(bob.last().type).toBe("content");
            expect(bob.last().by.name).toBe("Alice");
            expect(alice.last().type).toBe("content");
        });
        test("names an unknown saver generically and tolerates empty forms", () => {
            const bob = makeStream();
            manager.addClient(formId, { userId: "u2", name: "Bob" }, bob);
            manager.broadcastContent(formId, update, { userId: "u9" });
            expect(bob.last().by).toEqual({ userId: "u9", name: "A collaborator" });
            expect(() => manager.broadcastContent("nobody-here", update, { userId: "u9" })).not.toThrow();
        });
        test("announces page structure changes to the other tabs only", () => {
            const alice = makeStream();
            const bob = makeStream();
            const aliceConn = manager.addClient(formId, { userId: "u1", name: "Alice" }, alice);
            manager.addClient(formId, { userId: "u2", name: "Bob" }, bob);
            const aliceCount = alice.messages.length;
            manager.broadcastStructureChange(formId, { userId: "u1", connectionId: aliceConn });
            expect(bob.last()).toEqual({ type: "structure" });
            expect(alice.messages).toHaveLength(aliceCount);
        });
    });
    test("a failing stream does not break broadcasts to others", () => {
        const bob = makeStream();
        manager.addClient(formId, { userId: "u1", name: "Alice" }, {
            write: () => {
                throw new Error("socket closed");
            },
        });
        jest.spyOn(console, "error").mockImplementation(() => { });
        expect(() => manager.addClient(formId, { userId: "u2", name: "Bob" }, bob)).not.toThrow();
        expect(bob.last().users).toHaveLength(2);
    });
});
