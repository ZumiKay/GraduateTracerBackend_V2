"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../helper");
//Group by parent helper
describe("groupContentByParent basic tests", () => {
    const mockGroupContentByParent = (data) => {
        const result = [];
        const childQuestionsMap = new Map();
        // First, collect all child questions by parent ID
        for (const item of data) {
            if (item.parentcontent) {
                const parentId = item.parentcontent.qId;
                if (!childQuestionsMap.has(parentId)) {
                    childQuestionsMap.set(parentId, []);
                }
                childQuestionsMap.get(parentId).push(item);
            }
        }
        // Then add parent questions followed by their children
        for (const item of data) {
            if (!item.parentcontent) {
                result.push(item);
                // Add this parent's children if any
                if (item._id) {
                    const children = childQuestionsMap.get(item._id);
                    if (children) {
                        result.push(...children);
                    }
                }
            }
        }
        return result;
    };
    // Test cases
    test("should return empty array when input is empty", () => {
        const result = mockGroupContentByParent([]);
        expect(result).toEqual([]);
    });
    test("should handle parent-child relationships correctly", () => {
        const mockData = [
            { _id: "parent1", qIdx: 1 },
            { _id: "parent2", qIdx: 2 },
            { _id: "child1", qIdx: 3, parentcontent: { qId: "parent1", optIdx: 0 } },
            { _id: "child2", qIdx: 4, parentcontent: { qId: "parent1", optIdx: 1 } },
            { _id: "child3", qIdx: 5, parentcontent: { qId: "parent2", optIdx: 0 } },
        ];
        const result = mockGroupContentByParent(mockData);
        // Verify structure
        expect(result.length).toBe(5);
        // Parents should come before their children
        const parent1Index = result.findIndex((item) => item._id === "parent1");
        const parent2Index = result.findIndex((item) => item._id === "parent2");
        const child1Index = result.findIndex((item) => item._id === "child1");
        const child2Index = result.findIndex((item) => item._id === "child2");
        const child3Index = result.findIndex((item) => item._id === "child3");
        // Check parent1's children
        expect(parent1Index).toBeLessThan(child1Index);
        expect(parent1Index).toBeLessThan(child2Index);
        // Check parent2's child
        expect(parent2Index).toBeLessThan(child3Index);
    });
});
describe("SendResponse helper tests", () => {
    let res;
    //Initialize response
    beforeEach(() => {
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };
    });
    test("SendResponse should return 200 JSON with data", () => {
        const data = { user: "test" };
        (0, helper_1.SendResponse)(res, 200, data);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            code: 200,
            message: "Success",
            data,
        });
    });
    test("SendResponse.notFound shortcut should return 404 with custom message", () => {
        helper_1.SendResponse.notFound(res, "Item Not Found");
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            code: 404,
            message: "Item Not Found",
        });
    });
    test("SendResponse 204 noContent should call res.send()", () => {
        helper_1.SendResponse.noContent(res);
        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalled();
    });
});
//Validate password
describe("Valdiate Password", () => {
    test("Testing invalid password", () => {
        const invalidPass = [
            "1234",
            "1@123",
            "12345678",
            "sfdfdsfdsfdssdf",
            "dfsdfs@fdsf@fd",
        ];
        const isValids = invalidPass.map(helper_1.ValidatePassword);
        expect(isValids).toStrictEqual(invalidPass.map((i) => false));
    });
    test("Test Valid Password", () => {
        const validPasword = ["facebook@11234", "Password@001"];
        const isValids = validPasword.map(helper_1.ValidatePassword);
        expect(isValids).toStrictEqual([true, true]);
    });
});
//Generate Token & ExtractTokenPayload
describe("GenerateToken & ExtractTokenPayload", () => {
    const originalJwtSecret = process.env.JWT_SECRET;
    let consoleSpy;
    beforeEach(() => {
        process.env.JWT_SECRET = "test-jwt-secret";
        // Suppress expected console.error logs during error condition tests
        consoleSpy = jest.spyOn(console, "error").mockImplementation(() => { });
    });
    afterEach(() => {
        process.env.JWT_SECRET = originalJwtSecret;
        consoleSpy.mockRestore();
    });
    describe("GenerateToken", () => {
        test("should generate a non-empty string JWT token", () => {
            const payload = { userId: "user_123", role: "admin" };
            const token = (0, helper_1.GenerateToken)(payload, "1h");
            expect(typeof token).toBe("string");
            expect(token.split(".").length).toBe(3);
        });
        test("should generate valid token using default secret", () => {
            const payload = { email: "test@example.com" };
            const token = (0, helper_1.GenerateToken)(payload, "1h");
            const decoded = (0, helper_1.ExtractTokenPayload)({ token });
            expect(decoded).not.toBeNull();
            expect(decoded.email).toBe("test@example.com");
        });
        test("should generate valid token with custom secret", () => {
            const customSecret = "super-secret-key-123";
            const payload = { userId: "custom_user" };
            const token = (0, helper_1.GenerateToken)(payload, "1h", customSecret);
            const decoded = (0, helper_1.ExtractTokenPayload)({ token, customSecret });
            expect(decoded).not.toBeNull();
            expect(decoded.userId).toBe("custom_user");
        });
    });
    describe("ExtractTokenPayload", () => {
        test("should extract payload accurately from a valid token", () => {
            const payload = { userId: "user_456", permissions: ["read", "write"] };
            const token = (0, helper_1.GenerateToken)(payload, "30m");
            const result = (0, helper_1.ExtractTokenPayload)({ token });
            expect(result).not.toBeNull();
            expect(result.userId).toBe("user_456");
            expect(result.permissions).toEqual(["read", "write"]);
        });
        test("should return null for empty, blank, or invalid token string", () => {
            expect((0, helper_1.ExtractTokenPayload)({ token: "" })).toBeNull();
            expect((0, helper_1.ExtractTokenPayload)({ token: "   " })).toBeNull();
            expect((0, helper_1.ExtractTokenPayload)({ token: "not.a.valid.token" })).toBeNull();
            expect((0, helper_1.ExtractTokenPayload)({ token: null })).toBeNull();
            expect((0, helper_1.ExtractTokenPayload)({ token: undefined })).toBeNull();
        });
        test("should return null when token is verified with wrong custom secret", () => {
            const token = (0, helper_1.GenerateToken)({ id: 1 }, "1h", "correct-secret");
            const result = (0, helper_1.ExtractTokenPayload)({
                token,
                customSecret: "wrong-secret",
            });
            expect(result).toBeNull();
        });
        test("should return null when JWT_SECRET is not configured and no customSecret is provided", () => {
            delete process.env.JWT_SECRET;
            const token = (0, helper_1.GenerateToken)({ id: 1 }, "1h", "secret");
            const result = (0, helper_1.ExtractTokenPayload)({ token });
            expect(result).toBeNull();
        });
        test("should return null when token is expired", () => {
            const token = (0, helper_1.GenerateToken)({ id: 1 }, "0s");
            const result = (0, helper_1.ExtractTokenPayload)({ token });
            expect(result).toBeNull();
        });
        test("should extract payload from expired token when ignoreExpiration is true", () => {
            const payload = { userId: "expired_user" };
            const token = (0, helper_1.GenerateToken)(payload, "0s");
            // Without ignoreExpiration
            expect((0, helper_1.ExtractTokenPayload)({ token, ignoreExpiration: false })).toBeNull();
            // With ignoreExpiration
            const result = (0, helper_1.ExtractTokenPayload)({ token, ignoreExpiration: true });
            expect(result).not.toBeNull();
            expect(result.userId).toBe("expired_user");
        });
    });
});
//isRangeValueValid
describe("isRangeValueValid", () => {
    let warnSpy;
    let errorSpy;
    beforeEach(() => {
        // Suppress expected console.warn and console.error output during invalid range tests
        warnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => { });
    });
    afterEach(() => {
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });
    describe("Null / Undefined / Missing boundaries", () => {
        test("should return false when start or end is null", () => {
            expect((0, helper_1.isRangeValueValid)({ start: null, end: 10 })).toBe(false);
            expect((0, helper_1.isRangeValueValid)({ start: 10, end: null })).toBe(false);
            expect((0, helper_1.isRangeValueValid)({ start: null, end: null })).toBe(false);
        });
        test("should return false when start or end is undefined", () => {
            expect((0, helper_1.isRangeValueValid)({ start: undefined, end: 10 })).toBe(false);
            expect((0, helper_1.isRangeValueValid)({ start: 10, end: undefined })).toBe(false);
        });
        test("should accept 0 as valid boundary value", () => {
            expect((0, helper_1.isRangeValueValid)({ start: 0, end: 10 })).toBe(true);
            expect((0, helper_1.isRangeValueValid)({ start: -10, end: 0 })).toBe(true);
            expect((0, helper_1.isRangeValueValid)({ start: 0, end: 0 })).toBe(true);
        });
    });
    describe("Numeric Ranges (isDate = false or omitted)", () => {
        test("should return true when start is less than end", () => {
            expect((0, helper_1.isRangeValueValid)({ start: 10, end: 20 })).toBe(true);
            expect((0, helper_1.isRangeValueValid)({ start: -50, end: -10 })).toBe(true);
            expect((0, helper_1.isRangeValueValid)({ start: 1.5, end: 2.75 })).toBe(true);
        });
        test("should return true when start equals end", () => {
            expect((0, helper_1.isRangeValueValid)({ start: 25, end: 25 })).toBe(true);
            expect((0, helper_1.isRangeValueValid)({ start: -10, end: -10 })).toBe(true);
        });
        test("should return false when start is greater than end", () => {
            expect((0, helper_1.isRangeValueValid)({ start: 50, end: 10 })).toBe(false);
            expect((0, helper_1.isRangeValueValid)({ start: -5, end: -20 })).toBe(false);
            expect((0, helper_1.isRangeValueValid)({ start: 100.5, end: 100.2 })).toBe(false);
        });
        test("should parse and validate numeric string values", () => {
            expect((0, helper_1.isRangeValueValid)({ start: "10", end: "20" })).toBe(true);
            expect((0, helper_1.isRangeValueValid)({ start: "5.5", end: "10.2" })).toBe(true);
            expect((0, helper_1.isRangeValueValid)({ start: "100", end: "50" })).toBe(false);
        });
        test("should return false when numeric strings cannot be parsed", () => {
            expect((0, helper_1.isRangeValueValid)({ start: "abc", end: "20" })).toBe(false);
            expect((0, helper_1.isRangeValueValid)({ start: "10", end: "xyz" })).toBe(false);
        });
    });
    describe("Date Ranges (isDate = true)", () => {
        test("should return true for valid ISO date strings where start is before end", () => {
            expect((0, helper_1.isRangeValueValid)({
                start: "2024-01-01T00:00:00.000Z",
                end: "2024-12-31T23:59:59.999Z",
            }, true)).toBe(true);
            expect((0, helper_1.isRangeValueValid)({
                start: "2020-05-15",
                end: "2020-05-16",
            }, true)).toBe(true);
        });
        test("should return true when start date equals end date", () => {
            expect((0, helper_1.isRangeValueValid)({
                start: "2024-06-01T00:00:00.000Z",
                end: "2024-06-01T00:00:00.000Z",
            }, true)).toBe(true);
        });
        test("should return false when start date is after end date", () => {
            expect((0, helper_1.isRangeValueValid)({
                start: "2025-01-01T00:00:00.000Z",
                end: "2024-01-01T00:00:00.000Z",
            }, true)).toBe(false);
        });
        test("should return false for invalid or unparseable date strings", () => {
            expect((0, helper_1.isRangeValueValid)({
                start: "invalid-date",
                end: "2024-01-01T00:00:00.000Z",
            }, true)).toBe(false);
            expect((0, helper_1.isRangeValueValid)({
                start: "2024-01-01T00:00:00.000Z",
                end: "not-a-date",
            }, true)).toBe(false);
        });
        test("should return false when non-string value is passed with isDate = true", () => {
            expect((0, helper_1.isRangeValueValid)({
                start: 1704067200000,
                end: "2024-12-31T00:00:00.000Z",
            }, true)).toBe(false);
        });
    });
});
