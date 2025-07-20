import express from "express";
import {
  getAvailableColumns,
  getExportJobs,
  createExportJob,
  getExportJob,
  deleteExportJob,
  downloadExportFile,
  quickExport,
} from "../controller/export.controller";
import UserMiddleware from "../middleware/User.middleware";

const router = express.Router();

// Get available columns for export - Enhanced Security
router.get(
  "/forms/:formId/columns",
  UserMiddleware.VerifyTokenAndSession as never,
  getAvailableColumns
);

// Get export jobs for a form - Enhanced Security
router.get(
  "/forms/:formId/exports",
  UserMiddleware.VerifyTokenAndSession as never,
  getExportJobs
);

// Create new export job - Enhanced Security
router.post(
  "/forms/:formId/exports",
  UserMiddleware.VerifyTokenAndSession as never,
  createExportJob
);

// Get export job by ID - Enhanced Security
router.get(
  "/forms/:formId/exports/:jobId",
  UserMiddleware.VerifyTokenAndSession as never,
  getExportJob
);

// Delete export job - Enhanced Security
router.delete(
  "/forms/:formId/exports/:jobId",
  UserMiddleware.VerifyTokenAndSession as never,
  deleteExportJob
);

// Download export file - Public access (requires valid filename token)
router.get("/download/:filename", downloadExportFile);

// Quick export - Enhanced Security
router.get(
  "/forms/:formId/quick",
  UserMiddleware.VerifyTokenAndSession as never,
  quickExport
);

export default router;
