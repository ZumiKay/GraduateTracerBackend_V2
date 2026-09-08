"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateExpirationDate = void 0;
const User_model_1 = require("../../model/User.model");
const mockdata_1 = require("../../utilities/mockdata");
const FormLinkService_1 = __importDefault(require("../FormLinkService"));
// Mock configuration
const baseUrl = "http://localhost:5173";
const secret = "invite-secret-test-key";
const generateExpirationDate = ({ days = 0, hours = 0, minutes = 0, minute = 0, seconds = 0, second = 0, milliseconds = 0, baseDate = Date.now(), } = {}) => {
    const baseMs = baseDate instanceof Date ? baseDate.getTime() : baseDate;
    const totalMinutes = minutes || minute;
    const totalSeconds = seconds || second;
    const offsetMs = days * 24 * 60 * 60 * 1000 +
        hours * 60 * 60 * 1000 +
        totalMinutes * 60 * 1000 +
        totalSeconds * 1000 +
        milliseconds;
    return baseMs + offsetMs;
};
exports.generateExpirationDate = generateExpirationDate;
describe("FormLinkService", () => {
    const formId = mockdata_1.MockContentFactory.createFormId();
    let formLinkService;
    beforeAll(() => {
        process.env.FRONTEND_URL = baseUrl;
        process.env.INVITE_LINK_SECRET = secret;
        formLinkService = new FormLinkService_1.default();
    });
    describe("generateInviteLink & validateInviteLink", () => {
        test("generates and validates an active invite link with future expiration", () => {
            const payload = {
                inviteCode: formLinkService.generateInviteCode(),
                formId: formId.toString(),
                role: User_model_1.ROLE.USER,
            };
            //Generate invite link with expiration in (2hrs)
            const inviteLink = formLinkService.generateInviteLink(payload, "/invite", 2);
            expect(inviteLink.url).toContain(`${baseUrl}/invite?invite=`);
            expect(inviteLink.encryptedCode).toBeTruthy();
            expect(inviteLink.expiresAt).toBeInstanceOf(Date);
            expect(inviteLink.expiresAt.getTime()).toBeGreaterThan(Date.now());
            //Validate the gerneated invite link with encryptCode
            const validation = formLinkService.validateInviteLink(inviteLink.encryptedCode);
            expect(validation.valid).toBe(true);
            expect(validation.data?.inviteCode).toBe(payload.inviteCode);
            expect(validation.data?.formId).toBe(payload.formId);
            expect(validation.data?.role).toBe(User_model_1.ROLE.USER);
        });
        test("correctly rejects expired invite link created with past expiration", () => {
            //Expiration date with minus hours
            const expiredTimestamp = (0, exports.generateExpirationDate)({ hours: -2 });
            const payload = {
                inviteCode: "expired-code",
                formId: formId.toString(),
                expiresAt: expiredTimestamp,
            };
            const encrypted = formLinkService.encrypt(JSON.stringify(payload));
            const validation = formLinkService.validateInviteLink(encrypted);
            expect(validation.valid).toBe(false);
            expect(validation.error).toBe("Invite link has expired");
        });
        test("returns invalid when encryptedCode is corrupted or invalid", () => {
            const errorSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => { });
            const validation = formLinkService.validateInviteLink("corrupted-token-string");
            expect(validation.valid).toBe(false);
            expect(validation.error).toBe("Invalid invite link");
            //Restore mock to the initial
            errorSpy.mockRestore();
        });
    });
    describe("Form Link Utilities", () => {
        test("generateFormLink generates correct basic form url", () => {
            const link = formLinkService.generateFormLink(formId.toString());
            expect(link.url).toBe(`${baseUrl}/form-access/${formId.toString()}`);
            expect(link.isSecure).toBe(false);
        });
        test("extractFormIdFromUrl parses form ID from valid URL", () => {
            const url = `${baseUrl}/form-access/${formId.toString()}`;
            const extracted = formLinkService.extractFormIdFromUrl(url);
            expect(extracted).toBe(formId.toString());
        });
        test("extractFormIdFromUrl returns null for invalid URL without form-access path", () => {
            const errorSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => { });
            expect(formLinkService.extractFormIdFromUrl(`${baseUrl}/other-path/123`)).toBeNull();
            expect(formLinkService.extractFormIdFromUrl("invalid-url-string")).toBeNull();
            errorSpy.mockRestore();
        });
        test("generateSecureFormLink generates link with access token and expiration", () => {
            const link = formLinkService.generateSecureFormLink(formId.toString(), 12);
            expect(link.url).toContain(`${baseUrl}/form-access/${formId.toString()}/`);
            expect(link.isSecure).toBe(true);
            expect(link.accessToken).toHaveLength(64);
            expect(link.expiresAt).toBeInstanceOf(Date);
        });
        test("validateAccessToken accepts 64-character hex tokens and rejects invalid", async () => {
            const validToken = "a".repeat(64);
            const invalidToken = "short-token";
            expect(await formLinkService.validateAccessToken(formId.toString(), validToken)).toBe(true);
            expect(await formLinkService.validateAccessToken(formId.toString(), invalidToken)).toBe(false);
            expect(await formLinkService.validateAccessToken(formId.toString(), "")).toBe(false);
        });
        test("generateBatchLinks generates requested quantity of links", () => {
            const links = formLinkService.generateBatchLinks(formId.toString(), 5, true);
            expect(links).toHaveLength(5);
            links.forEach((link) => {
                expect(link.isSecure).toBe(true);
                expect(link.accessToken).toHaveLength(64);
            });
        });
    });
});
