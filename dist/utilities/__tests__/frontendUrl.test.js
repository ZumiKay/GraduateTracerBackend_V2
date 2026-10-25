"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const frontendUrl_1 = require("../frontendUrl");
const FormLinkService_1 = __importDefault(require("../../services/FormLinkService"));
describe("getFrontendBaseUrl", () => {
    const original = { ...process.env };
    afterEach(() => {
        process.env = { ...original };
    });
    const withEnv = (vars) => {
        const env = process.env;
        delete env.FRONTEND_LINK_URL;
        delete env.FRONTEND_URL;
        Object.assign(process.env, vars);
    };
    test("prefers FRONTEND_LINK_URL", () => {
        withEnv({
            FRONTEND_LINK_URL: "https://app.example.com/",
            FRONTEND_URL: "localhost:5173,other.example.com",
        });
        expect((0, frontendUrl_1.getFrontendBaseUrl)()).toBe("https://app.example.com");
    });
    test("uses the first FRONTEND_URL entry and adds a scheme", () => {
        withEnv({ FRONTEND_URL: "localhost:5173,tunnel.ngrok-free.dev" });
        expect((0, frontendUrl_1.getFrontendBaseUrl)()).toBe("http://localhost:5173");
        withEnv({ FRONTEND_URL: "tunnel.ngrok-free.dev,localhost:5173" });
        expect((0, frontendUrl_1.getFrontendBaseUrl)()).toBe("https://tunnel.ngrok-free.dev");
    });
    test("adds https for public hosts and http for local ones", () => {
        withEnv({ FRONTEND_LINK_URL: "forms.example.com" });
        expect((0, frontendUrl_1.getFrontendBaseUrl)()).toBe("https://forms.example.com");
        withEnv({ FRONTEND_LINK_URL: "127.0.0.1:5173" });
        expect((0, frontendUrl_1.getFrontendBaseUrl)()).toBe("http://127.0.0.1:5173");
    });
    test("keeps an explicit scheme and strips quotes and trailing slashes", () => {
        withEnv({ FRONTEND_LINK_URL: '"http://staging.example.com//"' });
        expect((0, frontendUrl_1.getFrontendBaseUrl)()).toBe("http://staging.example.com");
    });
    test("invite links are absolute even when FRONTEND_URL is a scheme-less CORS list", () => {
        withEnv({ FRONTEND_URL: "localhost:5173,tunnel.ngrok-free.dev" });
        const link = new FormLinkService_1.default().generateInviteLink({ inviteCode: "abc", formId: "f1" }, "/collaborator/confirm", 24);
        expect(link.url).toMatch(/^http:\/\/localhost:5173\/collaborator\/confirm\?invite=[\w-]+$/);
    });
    test("falls back to the local dev server", () => {
        withEnv({});
        expect((0, frontendUrl_1.getFrontendBaseUrl)()).toBe("http://localhost:5173");
    });
});
