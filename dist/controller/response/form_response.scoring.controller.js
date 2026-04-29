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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormResponseScoringController = void 0;
const helper_1 = require("../../utilities/helper");
const ResponseValidationService_1 = require("../../services/ResponseValidationService");
const ResponseProcessingService_1 = require("../../services/ResponseProcessingService");
class FormResponseScoringController {
    constructor() {
        this.UpdateResponseScore = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireFormId: false,
                });
                if (!validation.isValid || !((_a = validation.user) === null || _a === void 0 ? void 0 : _a.sub))
                    return;
                const { responseId, scores } = req.body;
                if (!responseId) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Response ID is required"));
                }
                if (!scores || !Array.isArray(scores) || scores.length === 0) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Scores array is required and must not be empty"));
                }
                for (const scoreEntry of scores) {
                    if (!scoreEntry.questionId || scoreEntry.score === undefined) {
                        return res
                            .status(400)
                            .json((0, helper_1.ReturnCode)(400, "Each score entry must have questionId and score"));
                    }
                }
                const { response, form } = yield ResponseValidationService_1.ResponseValidationService.validateResponseAccess(responseId, validation.user.sub, res);
                if (!response || !form)
                    return;
                const result = yield ResponseProcessingService_1.ResponseProcessingService.updateResponseScores({
                    responseId,
                    scores,
                });
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Scores updated successfully")), { data: result }));
            }
            catch (error) {
                console.error("Update Response Score Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to update scores"));
            }
        });
        this.UpdateQuestionScore = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireFormId: false,
                });
                if (!validation.isValid || !((_a = validation.user) === null || _a === void 0 ? void 0 : _a.sub))
                    return;
                const { responseId, questionId, score } = req.body;
                if (!responseId || !questionId || score === undefined) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Response ID, question ID, and score are required"));
                }
                const { response, form } = yield ResponseValidationService_1.ResponseValidationService.validateResponseAccess(responseId, validation.user.sub, res);
                if (!response || !form)
                    return;
                yield ResponseProcessingService_1.ResponseProcessingService.updateResponseScores({
                    responseId,
                    scores: [{ questionId, score: Number(score) }],
                });
                res
                    .status(200)
                    .json((0, helper_1.ReturnCode)(200, "Question score updated successfully"));
            }
            catch (error) {
                console.error("Update Question Score Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to update question score"));
            }
        });
        this.BatchUpdateScores = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireFormId: false,
                });
                if (!validation.isValid || !((_a = validation.user) === null || _a === void 0 ? void 0 : _a.sub))
                    return;
                const { updates } = req.body;
                if (!updates || !Array.isArray(updates) || updates.length === 0) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Updates array is required"));
                }
                for (const update of updates) {
                    if (!update.responseId ||
                        !update.scores ||
                        !Array.isArray(update.scores)) {
                        return res
                            .status(400)
                            .json((0, helper_1.ReturnCode)(400, "Each update must have responseId and scores array"));
                    }
                }
                const result = yield ResponseProcessingService_1.ResponseProcessingService.batchUpdateResponseScores(updates);
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Batch update completed")), { data: result }));
            }
            catch (error) {
                console.error("Batch Update Scores Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to batch update scores"));
            }
        });
        this.RecalculateResponseScore = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireFormId: false,
                });
                if (!validation.isValid || !((_a = validation.user) === null || _a === void 0 ? void 0 : _a.sub))
                    return;
                const { responseId } = req.body;
                if (!responseId) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Response ID is required"));
                }
                const result = yield ResponseProcessingService_1.ResponseProcessingService.recalculateResponseTotalScore(responseId);
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Score recalculated successfully")), { data: result }));
            }
            catch (error) {
                console.error("Recalculate Score Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to recalculate score"));
            }
        });
    }
}
exports.FormResponseScoringController = FormResponseScoringController;
exports.default = new FormResponseScoringController();
