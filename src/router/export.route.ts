import express from "express";
import UserMiddleware from "../middleware/User.middleware";
import {
  createExportJob,
  deleteExportJob,
  downloadExportFile,
  getAvailableColumns,
  getExportJob,
  getExportJobs,
  quickExport,
} from "../controller/utils/export.controller";

const router = express.Router();

// Get available columns for export - Enhanced Security
router.get(
  "/forms/:formId/columns",
  UserMiddleware.VerifyToken as never,
  getAvailableColumns
);

// Get export jobs for a form - Enhanced Security
router.get(
  "/forms/:formId/exports",
  UserMiddleware.VerifyToken as never,
  getExportJobs
);

// Create new export job - Enhanced Security
router.post(
  "/forms/:formId/exports",
  UserMiddleware.VerifyToken as never,
  createExportJob
);

// Get export job by ID - Enhanced Security
router.get(
  "/forms/:formId/exports/:jobId",
  UserMiddleware.VerifyToken as never,
  getExportJob
);

// Delete export job - Enhanced Security
router.delete(
  "/forms/:formId/exports/:jobId",
  UserMiddleware.VerifyToken as never,
  deleteExportJob
);

// Download export file - Public access (requires valid filename token)
router.get("/download/:filename", downloadExportFile);

// Quick export - Enhanced Security
router.get(
  "/forms/:formId/quick",
  UserMiddleware.VerifyToken as never,
  quickExport
);

export default router;
