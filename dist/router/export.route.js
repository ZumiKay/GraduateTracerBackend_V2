"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const export_controller_1 = require("../controller/export.controller");
const User_middleware_1 = __importDefault(require("../middleware/User.middleware"));
const router = express_1.default.Router();
// Get available columns for export
router.get("/forms/:formId/columns", User_middleware_1.default.VerifyToken, export_controller_1.getAvailableColumns);
// Get export jobs for a form
router.get("/forms/:formId/exports", User_middleware_1.default.VerifyToken, export_controller_1.getExportJobs);
// Create new export job
router.post("/forms/:formId/exports", User_middleware_1.default.VerifyToken, export_controller_1.createExportJob);
// Get export job by ID
router.get("/forms/:formId/exports/:jobId", User_middleware_1.default.VerifyToken, export_controller_1.getExportJob);
// Delete export job
router.delete("/forms/:formId/exports/:jobId", User_middleware_1.default.VerifyToken, export_controller_1.deleteExportJob);
// Download export file
router.get("/download/:filename", export_controller_1.downloadExportFile);
// Quick export
router.get("/forms/:formId/quick", User_middleware_1.default.VerifyToken, export_controller_1.quickExport);
exports.default = router;
