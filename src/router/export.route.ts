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

// Get available columns for export
router.get(
  "/forms/:formId/columns",
  UserMiddleware.VerifyToken as never,
  getAvailableColumns
);

// Get export jobs for a form
router.get(
  "/forms/:formId/exports",
  UserMiddleware.VerifyToken as never,
  getExportJobs
);

// Create new export job
router.post(
  "/forms/:formId/exports",
  UserMiddleware.VerifyToken as never,
  createExportJob
);

// Get export job by ID
router.get(
  "/forms/:formId/exports/:jobId",
  UserMiddleware.VerifyToken as never,
  getExportJob
);

// Delete export job
router.delete(
  "/forms/:formId/exports/:jobId",
  UserMiddleware.VerifyToken as never,
  deleteExportJob
);

// Download export file
router.get("/download/:filename", downloadExportFile);

// Quick export
router.get(
  "/forms/:formId/quick",
  UserMiddleware.VerifyToken as never,
  quickExport
);

export default router;
