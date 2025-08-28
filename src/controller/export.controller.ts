import { Request, Response } from "express";
import Form from "../model/Form.model";
import FormResponse from "../model/Response.model";
import Content from "../model/Content.model";
import { CustomRequest } from "../types/customType";
import { getResponseDisplayName } from "../utilities/respondentUtils";
import { ReturnCode } from "../utilities/helper";

// Get available columns for export
export async function getAvailableColumns(req: CustomRequest, res: Response) {
  try {
    const { formId } = req.params;

    const form = await Form.findById(formId).populate("contents");
    if (!form) {
      res.status(404).json(ReturnCode(404, "Form not found"));
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
      ...(form.contents || []).map(
        (content: any) =>
          content.questionText || content.title || `question_${content._id}`
      ),
    ];

    res.status(200).json({
      success: true,
      data: { columns },
    });
  } catch (error) {
    console.error("Error fetching available columns:", error);
    res.status(500).json(ReturnCode(500, "Failed to fetch available columns"));
  }
}

// Get export jobs for a form
export async function getExportJobs(req: CustomRequest, res: Response) {
  try {
    const { formId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const form = await Form.findById(formId);
    if (!form) {
      res.status(404).json(ReturnCode(404, "Form not found"));
      return;
    }

    // For now, return empty jobs array since ExportJob model doesn't exist yet
    // In a full implementation, this would query the ExportJob collection
    const jobs: any[] = [];
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
  } catch (error) {
    console.error("Error fetching export jobs:", error);
    res.status(500).json(ReturnCode(500, "Failed to fetch export jobs"));
  }
}

// Create new export job
export async function createExportJob(req: CustomRequest, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json(ReturnCode(401, "Authentication required"));
      return;
    }

    const { formId } = req.params;
    const exportConfig = req.body;

    const form = await Form.findById(formId);
    if (!form) {
      res.status(404).json(ReturnCode(404, "Form not found"));
      return;
    }

    // Validate export config
    if (
      !exportConfig.format ||
      !exportConfig.columns ||
      !Array.isArray(exportConfig.columns)
    ) {
      res.status(400).json(ReturnCode(400, "Invalid export configuration"));
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
  } catch (error) {
    console.error("Error creating export job:", error);
    res.status(500).json(ReturnCode(500, "Failed to create export job"));
  }
}

// Get export job by ID
export async function getExportJob(req: CustomRequest, res: Response) {
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
      createdBy: req.user?.id,
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
  } catch (error) {
    console.error("Error fetching export job:", error);
    res.status(500).json(ReturnCode(500, "Failed to fetch export job"));
  }
}

// Delete export job
export async function deleteExportJob(req: CustomRequest, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json(ReturnCode(401, "Authentication required"));
      return;
    }

    const { formId, jobId } = req.params;

    // Mock deletion for now
    res.status(200).json({
      success: true,
      message: "Export job deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting export job:", error);
    res.status(500).json(ReturnCode(500, "Failed to delete export job"));
  }
}

// Process export job (mock implementation)
const processExportJob = async (jobId: string, formId: string, config: any) => {
  try {
    // Get form responses
    const responses = await FormResponse.find({ formId }).populate(
      "userId",
      "email"
    );

    // Generate export file based on format
    const exportData = await generateExportFile(config, responses);

    console.log(
      `Export job ${jobId} completed with ${responses.length} records`
    );
  } catch (error) {
    console.error(`Error processing export job ${jobId}:`, error);
  }
};

// Download export file
export async function downloadExportFile(req: CustomRequest, res: Response) {
  try {
    const { filename } = req.params;

    // Mock file download for now
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res
      .status(200)
      .send("id,createdAt,totalScore\n1,2024-01-01,85\n2,2024-01-02,92");
  } catch (error) {
    console.error("Error downloading export file:", error);
    res.status(500).json(ReturnCode(500, "Failed to download export file"));
  }
}

// Quick export without job creation
export async function quickExport(req: CustomRequest, res: Response) {
  try {
    const { formId } = req.params;
    const { format = "csv" } = req.query;

    const form = await Form.findById(formId);
    if (!form) {
      res.status(404).json(ReturnCode(404, "Form not found"));
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
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send(csvContent);
      return;
    } else if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.json(exportData);
      return;
    }

    res.status(400).json(ReturnCode(400, "Unsupported format"));
  } catch (error) {
    console.error("Error performing quick export:", error);
    res.status(500).json(ReturnCode(500, "Failed to perform quick export"));
  }
}

// Generate export file
const generateExportFile = async (config: any, responses: any[]) => {
  const { format, columns, includeHeaders, includeMetadata, dateFormat } =
    config;

  // Process responses based on configuration
  const processedData = responses.map((response) => {
    const row: any = {};

    columns.forEach((column: string) => {
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
          row[column] = response.userId?._id || "";
          break;
        case "userEmail":
          row[column] =
            response.userId?.email || response.respondentEmail || "";
          break;
        case "guestEmail":
          row[column] = response.guest?.email || "";
          break;
        case "guestName":
          row[column] = getResponseDisplayName(response);
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
          const fieldData = response.responseset?.find(
            (r: any) => r.questionId.toString() === column
          );
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
};

// Helper functions
const formatDate = (date: Date, format: string) => {
  if (!date) return "";

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

const generateCSV = (data: any[], includeHeaders: boolean) => {
  if (data.length === 0) return "";

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

const generatePDF = (data: any[]) => {
  // Mock PDF generation
  return `PDF Report\n\nData: ${JSON.stringify(data, null, 2)}`;
};

export { processExportJob, generateExportFile };
