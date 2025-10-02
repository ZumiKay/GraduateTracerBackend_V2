"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateExportFile = exports.processExportJob = void 0;
exports.getAvailableColumns = getAvailableColumns;
exports.getExportJobs = getExportJobs;
exports.createExportJob = createExportJob;
exports.getExportJob = getExportJob;
exports.deleteExportJob = deleteExportJob;
exports.downloadExportFile = downloadExportFile;
exports.quickExport = quickExport;
const Form_model_1 = __importDefault(require("../model/Form.model"));
const Response_model_1 = __importDefault(require("../model/Response.model"));
const respondentUtils_1 = require("../utilities/respondentUtils");
const helper_1 = require("../utilities/helper");
const MongoErrorHandler_1 = require("../utilities/MongoErrorHandler");
// Get available columns for export
function getAvailableColumns(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const operationId = (0, MongoErrorHandler_1.generateOperationId)("get_available_columns");
        try {
            const { formId } = req.params;
            const form = yield Form_model_1.default.findById(formId).populate("contents");
            if (!form) {
                res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                return;
            }
            // Extract column names from form structure
            const columns = [
                "id",
                "createdAt",
                "updatedAt",
                "userId",
                "userEmail",
                "guestEmail",
                "guestName",
                "totalScore",
                "isCompleted",
                "completionStatus",
                "submittedAt",
                // Add form content/question columns
                ...(form.contents || []).map((content) => content.questionText || content.title || `question_${content._id}`),
            ];
            res.status(200).json({
                success: true,
                data: { columns },
            });
        }
        catch (error) {
            if ((0, MongoErrorHandler_1.handleDatabaseError)(error, res, "get available columns")) {
                return;
            }
            console.error(`[${operationId}] Error fetching available columns:`, error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to fetch available columns"));
        }
    });
}
// Get export jobs for a form
function getExportJobs(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { formId } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const form = yield Form_model_1.default.findById(formId);
            if (!form) {
                res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                return;
            }
            // For now, return empty jobs array since ExportJob model doesn't exist yet
            // In a full implementation, this would query the ExportJob collection
            const jobs = [];
            const total = 0;
            res.status(200).json({
                success: true,
                data: {
                    jobs,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                        pages: Math.ceil(total / Number(limit)),
                    },
                },
            });
        }
        catch (error) {
            console.error("Error fetching export jobs:", error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to fetch export jobs"));
        }
    });
}
// Create new export job
function createExportJob(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!req.user) {
                res.status(401).json((0, helper_1.ReturnCode)(401, "Authentication required"));
                return;
            }
            const { formId } = req.params;
            const exportConfig = req.body;
            const form = yield Form_model_1.default.findById(formId);
            if (!form) {
                res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                return;
            }
            // Validate export config
            if (!exportConfig.format ||
                !exportConfig.columns ||
                !Array.isArray(exportConfig.columns)) {
                res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid export configuration"));
                return;
            }
            // Create mock export job for now
            const job = {
                id: Date.now().toString(),
                formId,
                formName: form.title,
                config: exportConfig,
                status: "pending",
                progress: 0,
                createdBy: req.user.id,
                createdAt: new Date().toISOString(),
            };
            // Start export process
            setTimeout(() => processExportJob(job.id, formId, exportConfig), 1000);
            res.status(201).json({
                success: true,
                data: { job },
                message: "Export job created successfully",
            });
        }
        catch (error) {
            console.error("Error creating export job:", error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to create export job"));
        }
    });
}
// Get export job by ID
function getExportJob(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { formId, jobId } = req.params;
            // Mock job data for now
            const job = {
                id: jobId,
                formId,
                formName: "Sample Form",
                config: {
                    format: "csv",
                    columns: ["id", "createdAt", "totalScore"],
                    includeHeaders: true,
                    includeMetadata: false,
                    dateFormat: "local",
                },
                status: "completed",
                progress: 100,
                createdBy: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                createdAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                downloadUrl: `/api/exports/download/${jobId}.csv`,
                recordCount: 100,
                fileSize: 25600,
            };
            res.status(200).json({
                success: true,
                data: { job },
            });
        }
        catch (error) {
            console.error("Error fetching export job:", error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to fetch export job"));
        }
    });
}
// Delete export job
function deleteExportJob(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!req.user) {
                res.status(401).json((0, helper_1.ReturnCode)(401, "Authentication required"));
                return;
            }
            const { formId, jobId } = req.params;
            // Mock deletion for now
            res.status(200).json({
                success: true,
                message: "Export job deleted successfully",
            });
        }
        catch (error) {
            console.error("Error deleting export job:", error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to delete export job"));
        }
    });
}
// Process export job (mock implementation)
const processExportJob = (jobId, formId, config) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get form responses
        const responses = yield Response_model_1.default.find({ formId }).populate("userId", "email");
        // Generate export file based on format
        const exportData = yield generateExportFile(config, responses);
        console.log(`Export job ${jobId} completed with ${responses.length} records`);
    }
    catch (error) {
        console.error(`Error processing export job ${jobId}:`, error);
    }
});
exports.processExportJob = processExportJob;
// Download export file
function downloadExportFile(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { filename } = req.params;
            // Mock file download for now
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res
                .status(200)
                .send("id,createdAt,totalScore\n1,2024-01-01,85\n2,2024-01-02,92");
        }
        catch (error) {
            console.error("Error downloading export file:", error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to download export file"));
        }
    });
}
// Quick export without job creation
function quickExport(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { formId } = req.params;
            const { format = "csv" } = req.query;
            const form = yield Form_model_1.default.findById(formId);
            if (!form) {
                res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                return;
            }
            // Get basic columns
            const columns = [
                "id",
                "createdAt",
                "totalScore",
                "completionRate",
                "timeSpent",
                "guestType",
            ];
            // Mock export data
            const exportData = [
                {
                    id: "1",
                    createdAt: "2024-01-01T10:00:00Z",
                    totalScore: 85,
                    completionRate: 100,
                    timeSpent: 300,
                    guestType: "registered",
                },
                {
                    id: "2",
                    createdAt: "2024-01-02T14:30:00Z",
                    totalScore: 92,
                    completionRate: 95,
                    timeSpent: 280,
                    guestType: "guest",
                },
            ];
            // Generate export file
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const filename = `${form.title}_${timestamp}.${format}`;
            if (format === "csv") {
                const csvContent = generateCSV(exportData, true);
                res.setHeader("Content-Type", "text/csv");
                res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
                res.send(csvContent);
                return;
            }
            else if (format === "json") {
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
                res.json(exportData);
                return;
            }
            res.status(400).json((0, helper_1.ReturnCode)(400, "Unsupported format"));
        }
        catch (error) {
            console.error("Error performing quick export:", error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to perform quick export"));
        }
    });
}
// Generate export file
const generateExportFile = (config, responses) => __awaiter(void 0, void 0, void 0, function* () {
    const { format, columns, includeHeaders, includeMetadata, dateFormat } = config;
    // Process responses based on configuration
    const processedData = responses.map((response) => {
        const row = {};
        columns.forEach((column) => {
            var _a, _b, _c, _d;
            switch (column) {
                case "id":
                    row[column] = response._id;
                    break;
                case "createdAt":
                case "updatedAt":
                case "submittedAt":
                    row[column] = formatDate(response[column], dateFormat);
                    break;
                case "userId":
                    row[column] = ((_a = response.userId) === null || _a === void 0 ? void 0 : _a._id) || "";
                    break;
                case "userEmail":
                    row[column] =
                        ((_b = response.userId) === null || _b === void 0 ? void 0 : _b.email) || response.respondentEmail || "";
                    break;
                case "guestEmail":
                    row[column] = ((_c = response.guest) === null || _c === void 0 ? void 0 : _c.email) || "";
                    break;
                case "guestName":
                    row[column] = (0, respondentUtils_1.getResponseDisplayName)(response);
                    break;
                case "totalScore":
                    row[column] = response.totalScore || 0;
                    break;
                case "isCompleted":
                    row[column] = response.isCompleted || false;
                    break;
                case "completionStatus":
                    row[column] = response.completionStatus || "partial";
                    break;
                default:
                    // Handle form field data
                    const fieldData = (_d = response.responseset) === null || _d === void 0 ? void 0 : _d.find((r) => r.questionId.toString() === column);
                    row[column] = fieldData ? fieldData.response : "";
            }
        });
        return row;
    });
    // Generate file based on format
    let fileContent = "";
    let mimeType = "text/plain";
    switch (format) {
        case "csv":
            fileContent = generateCSV(processedData, includeHeaders);
            mimeType = "text/csv";
            break;
        case "json":
            fileContent = JSON.stringify(processedData, null, 2);
            mimeType = "application/json";
            break;
        case "excel":
            // Use CSV for now, in production use exceljs
            fileContent = generateCSV(processedData, includeHeaders);
            mimeType = "application/vnd.ms-excel";
            break;
        case "pdf":
            // Mock PDF generation
            fileContent = generatePDF(processedData);
            mimeType = "application/pdf";
            break;
        default:
            fileContent = generateCSV(processedData, includeHeaders);
            mimeType = "text/csv";
    }
    return {
        content: fileContent,
        mimeType,
        size: Buffer.byteLength(fileContent, "utf8"),
    };
});
exports.generateExportFile = generateExportFile;
// Helper functions
const formatDate = (date, format) => {
    if (!date)
        return "";
    switch (format) {
        case "iso":
            return date.toISOString();
        case "timestamp":
            return date.getTime().toString();
        case "local":
        default:
            return date.toLocaleString();
    }
};
const generateCSV = (data, includeHeaders) => {
    if (data.length === 0)
        return "";
    const headers = Object.keys(data[0]);
    let csv = "";
    if (includeHeaders) {
        csv += headers.join(",") + "\n";
    }
    data.forEach((row) => {
        const values = headers.map((header) => {
            const value = row[header] || "";
            // Escape commas and quotes
            return `"${value.toString().replace(/"/g, '""')}"`;
        });
        csv += values.join(",") + "\n";
    });
    return csv;
};
const generatePDF = (data) => {
    // Mock PDF generation
    return `PDF Report\n\nData: ${JSON.stringify(data, null, 2)}`;
};
