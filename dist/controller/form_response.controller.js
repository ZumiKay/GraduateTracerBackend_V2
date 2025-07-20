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
exports.FormResponseController = void 0;
const helper_1 = require("../utilities/helper");
const Response_model_1 = __importDefault(require("../model/Response.model"));
const zod_1 = __importDefault(require("zod"));
const Content_model_1 = __importDefault(require("../model/Content.model"));
const mongoose_1 = require("mongoose");
const Form_model_1 = require("../model/Form.model");
const SolutionValidationService_1 = __importDefault(require("../services/SolutionValidationService"));
const EmailService_1 = __importDefault(require("../services/EmailService"));
const FormLinkService_1 = __importDefault(require("../services/FormLinkService"));
const Form_model_2 = __importDefault(require("../model/Form.model"));
const User_model_1 = __importDefault(require("../model/User.model"));
const form_controller_1 = require("./form.controller");
class FormResponseController {
    constructor() {
        this.SubmitResponse = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const submitdata = req.body;
            try {
                // Validate form exists and accepts responses
                const form = yield Form_model_2.default.findById(submitdata.formId);
                if (!form) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                if (((_a = form.setting) === null || _a === void 0 ? void 0 : _a.acceptResponses) === false) {
                    return res
                        .status(403)
                        .json((0, helper_1.ReturnCode)(403, "Form is no longer accepting responses"));
                }
                let scoredResponses = submitdata.responseset;
                if (submitdata.returnscore === Form_model_1.returnscore.partial) {
                    scoredResponses = yield Promise.all(submitdata.responseset.map((response) => __awaiter(this, void 0, void 0, function* () {
                        return yield this.AddScore(new mongoose_1.Types.ObjectId(response.questionId), response);
                    })));
                }
                yield Response_model_1.default.create(Object.assign(Object.assign({}, submitdata), { responseset: scoredResponses, userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id }));
                res.status(200).json((0, helper_1.ReturnCode)(200, "Form Submitted"));
            }
            catch (error) {
                console.error("Submit Response Error:", { error, body: req.body });
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to submit the form"));
            }
        });
        this.SubmitPublicResponse = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const { formId, responses, respondentEmail, respondentName } = req.body;
            try {
                // Validate form exists
                const form = yield Form_model_2.default.findById(formId);
                if (!form) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                // Check if form accepts responses
                if (((_a = form.setting) === null || _a === void 0 ? void 0 : _a.acceptResponses) === false) {
                    return res
                        .status(403)
                        .json((0, helper_1.ReturnCode)(403, "Form is no longer accepting responses"));
                }
                // Get form questions to validate responses
                const questions = yield Content_model_1.default.find({
                    formId: new mongoose_1.Types.ObjectId(formId),
                });
                // Validate required questions are answered
                const requiredQuestions = questions.filter((q) => q.require);
                const missingResponses = requiredQuestions.filter((q) => {
                    const response = responses.find((r) => { var _a; return r.questionId === ((_a = q._id) === null || _a === void 0 ? void 0 : _a.toString()); });
                    return !response || !response.response || response.response === "";
                });
                if (missingResponses.length > 0) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Please complete all required fields"));
                }
                // Score responses if form has scoring
                let scoredResponses = responses;
                let totalScore = 0;
                if (((_b = form.setting) === null || _b === void 0 ? void 0 : _b.returnscore) &&
                    form.setting.returnscore !== Form_model_1.returnscore.manual) {
                    scoredResponses = yield Promise.all(responses.map((response) => __awaiter(this, void 0, void 0, function* () {
                        const scored = yield this.AddScore(new mongoose_1.Types.ObjectId(response.questionId), response);
                        if (scored.score) {
                            totalScore += scored.score;
                        }
                        return scored;
                    })));
                }
                // Create response record
                const formResponse = yield Response_model_1.default.create({
                    formId: new mongoose_1.Types.ObjectId(formId),
                    responseset: scoredResponses,
                    totalScore,
                    returnscore: ((_c = form.setting) === null || _c === void 0 ? void 0 : _c.returnscore) || Form_model_1.returnscore.manual,
                    completionStatus: "completed",
                    respondentEmail,
                    respondentName,
                    submittedAt: new Date(),
                });
                // Send email with results if it's a quiz and email is provided
                if (((_d = form.setting) === null || _d === void 0 ? void 0 : _d.returnscore) === Form_model_1.returnscore.partial &&
                    respondentEmail) {
                    try {
                        // TODO: Implement email service for sending quiz results
                        console.log("Would send quiz results to:", respondentEmail);
                    }
                    catch (emailError) {
                        console.error("Failed to send results email:", emailError);
                        // Don't fail the submission if email fails
                    }
                }
                res.status(200).json((0, helper_1.ReturnCode)(200, "Form submitted successfully"));
            }
            catch (error) {
                console.error("Submit Public Response Error:", { error, body: req.body });
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to submit the form"));
            }
        });
        this.GetResponseByFormId = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const id = req.query.id;
            const page = Number(req.query.p) || FormResponseController.DEFAULT_PAGE;
            const limit = Number(req.query.lt) || FormResponseController.DEFAULT_LIMIT;
            const user = req.user;
            // Check if user is authenticated
            if (!user) {
                return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
            }
            if (!id) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
            }
            try {
                // Verify form access
                const form = yield Form_model_2.default.findById(id)
                    .populate({ path: "user", select: "email" })
                    .lean();
                if (!form) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                if (!(0, form_controller_1.hasFormAccess)(form, user.id.toString())) {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
                }
                const responses = yield Response_model_1.default.find({ formId: id })
                    .skip((page - 1) * limit)
                    .limit(limit);
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: responses }));
            }
            catch (error) {
                console.error("Get Response By FormId Error:", {
                    error,
                    query: req.query,
                });
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve responses"));
            }
        });
        this.GetResponseByUserId = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const userId = req.query.userId;
            if (!userId) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "User ID is required"));
            }
            try {
                const response = yield Response_model_1.default.findOne({ userId });
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: response }));
            }
            catch (error) {
                console.error("Get Response By UserId Error:", {
                    error,
                    query: req.query,
                });
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve response"));
            }
        });
        this.GetGuestResponse = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { formId } = req.query;
            try {
                const response = yield Response_model_1.default.find({
                    $and: [{ formId }, { userId: null }],
                });
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: response }));
            }
            catch (error) {
                console.log("Get Guest Response", error);
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
        this.ValidateFormForSubmission = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { formId } = req.query;
            if (!formId || typeof formId !== "string") {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
            }
            try {
                const validationSummary = yield SolutionValidationService_1.default.validateForm(formId);
                const errors = yield SolutionValidationService_1.default.getFormValidationErrors(formId);
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign(Object.assign({}, validationSummary), { errors, canSubmit: errors.length === 0 }) }));
            }
            catch (error) {
                console.error("Validate Form Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to validate form"));
            }
        });
        //Add Score for the response
        this.AddScore = (qid, response) => __awaiter(this, void 0, void 0, function* () {
            try {
                const content = yield Content_model_1.default.findById(qid)
                    .select("answer score type")
                    .lean()
                    .exec();
                if (!(content === null || content === void 0 ? void 0 : content.answer) || !content.score)
                    return Object.assign(Object.assign({}, response), { score: 0 });
                const calculatedScore = SolutionValidationService_1.default.calculateResponseScore(response.response, content.answer.answer, content.type, content.score);
                return Object.assign(Object.assign({}, response), { score: calculatedScore });
            }
            catch (error) {
                console.error("AddScore Error:", error);
                return Object.assign(Object.assign({}, response), { score: 0 });
            }
        });
        // Send form links via email
        this.SendFormLinks = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { formId, emails, message } = req.body;
            const user = req.user;
            if (!formId || !emails || !Array.isArray(emails) || emails.length === 0) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "Form ID and email list are required"));
            }
            try {
                // Get form details
                const form = yield Form_model_2.default.findById(formId);
                if (!form) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                // Check if user owns the form
                if (form.user.toString() !== ((_a = user === null || user === void 0 ? void 0 : user.id) === null || _a === void 0 ? void 0 : _a.toString())) {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Unauthorized"));
                }
                const emailService = new EmailService_1.default();
                const userDetails = yield User_model_1.default.findById(user.id);
                const success = yield emailService.sendFormLinks({
                    formId,
                    formTitle: form.title,
                    formOwner: (userDetails === null || userDetails === void 0 ? void 0 : userDetails.email) || "Form Owner",
                    recipientEmails: emails,
                    message,
                });
                if (success) {
                    res.status(200).json((0, helper_1.ReturnCode)(200, "Form links sent successfully"));
                }
                else {
                    res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to send form links"));
                }
            }
            catch (error) {
                console.error("Send Form Links Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to send form links"));
            }
        });
        // Generate form link
        this.GenerateFormLink = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { formId, secure } = req.body;
            const user = req.user;
            if (!formId) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
            }
            try {
                // Get form details
                const form = yield Form_model_2.default.findById(formId);
                if (!form) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                // Check if user owns the form
                if (form.user.toString() !== ((_a = user === null || user === void 0 ? void 0 : user.id) === null || _a === void 0 ? void 0 : _a.toString())) {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Unauthorized"));
                }
                const linkService = new FormLinkService_1.default();
                const link = yield linkService.getValidatedFormLink(formId, secure);
                if (link) {
                    res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: link }));
                }
                else {
                    res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to generate form link"));
                }
            }
            catch (error) {
                console.error("Generate Form Link Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to generate form link"));
            }
        });
        // Get form for respondent (public access)
        this.GetFormForRespondent = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { formId } = req.params;
            const { token } = req.query;
            if (!formId) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
            }
            try {
                // Get form with contents
                const form = yield Form_model_2.default.findById(formId).populate("contentIds");
                if (!form) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                // If token is provided, validate it
                if (token && typeof token === "string") {
                    const linkService = new FormLinkService_1.default();
                    const isValidToken = yield linkService.validateAccessToken(formId, token);
                    if (!isValidToken) {
                        return res.status(401).json((0, helper_1.ReturnCode)(401, "Invalid access token"));
                    }
                }
                // Return form data (without answers for security)
                const formData = Object.assign(Object.assign({}, form.toObject()), { contentIds: (_a = form.contentIds) === null || _a === void 0 ? void 0 : _a.map((content) => (Object.assign(Object.assign({}, content.toObject()), { answer: undefined }))) });
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: formData }));
            }
            catch (error) {
                console.error("Get Form For Respondent Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve form"));
            }
        });
        // Submit form response (for respondents)
        this.SubmitFormResponse = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { formId, responseset, guestEmail, guestName } = req.body;
            const user = req.user;
            if (!formId ||
                !responseset ||
                !Array.isArray(responseset) ||
                responseset.length === 0) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "Form ID and responses are required"));
            }
            try {
                // Get form details
                const form = yield Form_model_2.default.findById(formId);
                if (!form) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                // Check if email is required
                if (form.requiredemail && !user && !guestEmail) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Email is required for this form"));
                }
                // Score responses if returnscore is partial
                let scoredResponses = responseset;
                let totalScore = 0;
                let isAutoScored = false;
                if (((_a = form.setting) === null || _a === void 0 ? void 0 : _a.returnscore) === Form_model_1.returnscore.partial) {
                    scoredResponses = yield Promise.all(responseset.map((response) => __awaiter(this, void 0, void 0, function* () {
                        return yield this.AddScore(new mongoose_1.Types.ObjectId(response.questionId), response);
                    })));
                    isAutoScored = true;
                }
                // Calculate total score
                totalScore = scoredResponses.reduce((sum, response) => {
                    return sum + (response.score || 0);
                }, 0);
                // Create response
                const responseData = {
                    formId: new mongoose_1.Types.ObjectId(formId),
                    responseset: scoredResponses,
                    totalScore,
                    isCompleted: true,
                    submittedAt: new Date(),
                    isAutoScored,
                    returnscore: (_b = form.setting) === null || _b === void 0 ? void 0 : _b.returnscore,
                };
                if (user) {
                    responseData.userId = new mongoose_1.Types.ObjectId(user.id);
                }
                else if (guestEmail) {
                    responseData.guest = { email: guestEmail, name: guestName };
                }
                const savedResponse = yield Response_model_1.default.create(responseData);
                // Send results email if auto-scored
                if (isAutoScored && (user || guestEmail)) {
                    const emailService = new EmailService_1.default();
                    const email = guestEmail; // Use guestEmail for guest users
                    if (email) {
                        yield emailService.sendResponseResults({
                            to: email,
                            formTitle: form.title,
                            totalScore,
                            maxScore: form.totalscore || 0,
                            responseId: savedResponse._id.toString(),
                            isAutoScored: true,
                        });
                    }
                }
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Form submitted successfully")), { data: {
                        responseId: savedResponse._id,
                        totalScore,
                        maxScore: form.totalscore || 0,
                        isAutoScored,
                    } }));
            }
            catch (error) {
                console.error("Submit Form Response Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to submit form"));
            }
        });
        // Get responses with filtering and pagination
        this.GetResponsesWithFilters = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { formId, email, startDate, endDate, minScore, maxScore, sortBy, sortOrder, } = req.query;
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 10;
            const user = req.user;
            // Check if user is authenticated
            if (!user) {
                return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
            }
            if (!formId) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
            }
            try {
                // Verify form access (including collaborators)
                const form = yield Form_model_2.default.findById(formId)
                    .populate({ path: "user", select: "email" })
                    .lean();
                if (!form) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                if (!(0, form_controller_1.hasFormAccess)(form, user.id.toString())) {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
                }
                // Build query
                const query = { formId };
                // Filter by email
                if (email) {
                    query.$or = [
                        { "guest.email": { $regex: email, $options: "i" } },
                        { userId: { $exists: true } }, // Will need to populate user data
                    ];
                }
                // Filter by date range
                if (startDate || endDate) {
                    query.submittedAt = {};
                    if (startDate)
                        query.submittedAt.$gte = new Date(startDate);
                    if (endDate)
                        query.submittedAt.$lte = new Date(endDate);
                }
                // Filter by score range
                if (minScore !== undefined || maxScore !== undefined) {
                    query.totalScore = {};
                    if (minScore !== undefined)
                        query.totalScore.$gte = Number(minScore);
                    if (maxScore !== undefined)
                        query.totalScore.$lte = Number(maxScore);
                }
                // Build sort options
                const sortOptions = {};
                if (sortBy) {
                    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;
                }
                else {
                    sortOptions.submittedAt = -1; // Default sort by newest
                }
                // Execute query
                const responses = yield Response_model_1.default.find(query)
                    .populate("userId", "name email")
                    .sort(sortOptions)
                    .skip((page - 1) * limit)
                    .limit(limit);
                const totalCount = yield Response_model_1.default.countDocuments(query);
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: {
                        responses,
                        pagination: {
                            page,
                            limit,
                            totalCount,
                            totalPages: Math.ceil(totalCount / limit),
                        },
                    } }));
            }
            catch (error) {
                console.error("Get Responses With Filters Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve responses"));
            }
        });
        // Manual scoring for responses
        this.UpdateResponseScore = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { responseId, scores, sendEmail } = req.body;
            const user = req.user;
            if (!responseId || !scores || !Array.isArray(scores)) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "Response ID and scores are required"));
            }
            try {
                // Get response
                const response = yield Response_model_1.default.findById(responseId).populate("formId");
                if (!response) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Response not found"));
                }
                // Check form ownership
                const form = response.formId;
                if (form.user.toString() !== ((_a = user === null || user === void 0 ? void 0 : user.id) === null || _a === void 0 ? void 0 : _a.toString())) {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Unauthorized"));
                }
                // Update scores
                const updatedResponseSet = response.responseset.map((responseItem) => {
                    const scoreUpdate = scores.find((s) => s.questionId === responseItem.questionId.toString());
                    if (scoreUpdate) {
                        return Object.assign(Object.assign({}, responseItem), { score: scoreUpdate.score, isManuallyScored: true });
                    }
                    return responseItem;
                });
                // Calculate new total score
                const totalScore = updatedResponseSet.reduce((sum, item) => sum + (item.score || 0), 0);
                // Update response
                yield Response_model_1.default.findByIdAndUpdate(responseId, {
                    responseset: updatedResponseSet,
                    totalScore,
                    isAutoScored: false,
                });
                // Send email if requested
                if (sendEmail) {
                    const emailService = new EmailService_1.default();
                    let recipientEmail = "";
                    if (response.userId) {
                        const userDetails = yield User_model_1.default.findById(response.userId);
                        recipientEmail = (userDetails === null || userDetails === void 0 ? void 0 : userDetails.email) || "";
                    }
                    else if ((_b = response.guest) === null || _b === void 0 ? void 0 : _b.email) {
                        recipientEmail = response.guest.email;
                    }
                    if (recipientEmail) {
                        yield emailService.sendResponseResults({
                            to: recipientEmail,
                            formTitle: form.title,
                            totalScore,
                            maxScore: form.totalscore || 0,
                            responseId: responseId,
                            isAutoScored: false,
                        });
                    }
                }
                res.status(200).json((0, helper_1.ReturnCode)(200, "Scores updated successfully"));
            }
            catch (error) {
                console.error("Update Response Score Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to update scores"));
            }
        });
        // Get response analytics for charts
        this.GetResponseAnalytics = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { formId } = req.query;
            const user = req.user;
            // Check if user is authenticated
            if (!user) {
                return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
            }
            if (!formId) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
            }
            try {
                // Verify form access (including collaborators)
                const form = yield Form_model_2.default.findById(formId)
                    .populate("contentIds")
                    .populate({ path: "user", select: "email" })
                    .lean();
                if (!form) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                if (!(0, form_controller_1.hasFormAccess)(form, user.id.toString())) {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
                }
                // Get all responses
                const responses = yield Response_model_1.default.find({ formId });
                // Analyze each question
                const analytics = {};
                if (form.contentIds && Array.isArray(form.contentIds)) {
                    for (const content of form.contentIds) {
                        const contentObj = content;
                        const questionId = contentObj._id.toString();
                        // Get all responses for this question
                        const questionResponses = responses
                            .map((response) => response.responseset.find((r) => r.questionId.toString() === questionId))
                            .filter(Boolean);
                        // Analyze based on question type
                        if (["multiple", "checkbox", "selection"].includes(contentObj.type)) {
                            // For multiple choice, checkbox, and selection questions
                            const answerCounts = {};
                            questionResponses.forEach((response) => {
                                if (response) {
                                    if (Array.isArray(response.response)) {
                                        response.response.forEach((answer) => {
                                            const key = answer.toString();
                                            answerCounts[key] = (answerCounts[key] || 0) + 1;
                                        });
                                    }
                                    else {
                                        const key = response.response.toString();
                                        answerCounts[key] = (answerCounts[key] || 0) + 1;
                                    }
                                }
                            });
                            analytics[questionId] = {
                                type: contentObj.type,
                                title: contentObj.title,
                                totalResponses: questionResponses.length,
                                answerCounts,
                                chartData: Object.entries(answerCounts).map(([answer, count]) => ({
                                    answer,
                                    count,
                                    percentage: ((count / questionResponses.length) *
                                        100).toFixed(1),
                                })),
                            };
                        }
                        else if (["rangedate", "rangenumber"].includes(contentObj.type)) {
                            // For range questions
                            const ranges = questionResponses
                                .map((response) => response === null || response === void 0 ? void 0 : response.response)
                                .filter(Boolean);
                            analytics[questionId] = {
                                type: contentObj.type,
                                title: contentObj.title,
                                totalResponses: questionResponses.length,
                                ranges,
                                // Could add more range-specific analytics here
                            };
                        }
                    }
                }
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: analytics }));
            }
            catch (error) {
                console.error("Get Response Analytics Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve analytics"));
            }
        });
        // Get public form data (for displaying form to respondents)
        this.GetPublicFormData = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { formId } = req.params;
            const { token } = req.query;
            if (!formId) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
            }
            try {
                // Get form with contents
                const form = yield Form_model_2.default.findById(formId).populate("contentIds");
                if (!form) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                // If token is provided, validate it
                if (token && typeof token === "string") {
                    const linkService = new FormLinkService_1.default();
                    const isValidToken = yield linkService.validateAccessToken(formId, token);
                    if (!isValidToken) {
                        return res.status(401).json((0, helper_1.ReturnCode)(401, "Invalid access token"));
                    }
                }
                // Return form data (without answers for security)
                const formData = Object.assign(Object.assign({}, form.toObject()), { contentIds: (_a = form.contentIds) === null || _a === void 0 ? void 0 : _a.map((content) => (Object.assign(Object.assign({}, content.toObject()), { answer: undefined }))) });
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: formData }));
            }
            catch (error) {
                console.error("Get Public Form Data Error:", {
                    error,
                    params: req.params,
                });
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve form data"));
            }
        });
        // Get analytics data for a form
        this.GetFormAnalytics = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { formId } = req.params;
            const { period = "7d" } = req.query;
            const user = req.user;
            // Check if user is authenticated
            if (!user) {
                return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
            }
            try {
                const form = yield Form_model_2.default.findById(formId)
                    .populate({ path: "user", select: "email" })
                    .lean();
                if (!form) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                // Check if user has access to this form
                if (!(0, form_controller_1.hasFormAccess)(form, user.id.toString())) {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
                }
                // Calculate date range based on period
                const now = new Date();
                let startDate;
                switch (period) {
                    case "7d":
                        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case "30d":
                        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        break;
                    case "90d":
                        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                        break;
                    default:
                        startDate = new Date(0); // All time
                }
                // Get responses within the date range
                const responses = yield Response_model_1.default.find({
                    formId: new mongoose_1.Types.ObjectId(formId),
                    createdAt: { $gte: startDate },
                }).sort({ createdAt: -1 });
                // Get form questions
                const questions = yield Content_model_1.default.find({
                    formId: new mongoose_1.Types.ObjectId(formId),
                });
                // Calculate basic metrics
                const totalResponses = responses.length;
                const completedResponses = responses.filter((r) => r.completionStatus === "completed").length;
                const averageScore = responses.reduce((sum, r) => sum + (r.totalScore || 0), 0) /
                    totalResponses || 0;
                const responseRate = totalResponses > 0 ? (completedResponses / totalResponses) * 100 : 0;
                // Calculate average completion time (mock data for now)
                const averageCompletionTime = 8; // minutes
                // Generate question analytics
                const questionAnalytics = yield Promise.all(questions.map((question) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const questionResponses = responses.filter((r) => r.responseset.some((rs) => { var _a; return rs.questionId.toString() === ((_a = question._id) === null || _a === void 0 ? void 0 : _a.toString()); }));
                    const questionResponsesData = questionResponses
                        .map((r) => r.responseset.find((rs) => { var _a; return rs.questionId.toString() === ((_a = question._id) === null || _a === void 0 ? void 0 : _a.toString()); }))
                        .filter(Boolean);
                    const correctResponses = questionResponsesData.filter((r) => (r === null || r === void 0 ? void 0 : r.score) && r.score > 0).length;
                    const accuracy = questionResponsesData.length > 0
                        ? (correctResponses / questionResponsesData.length) * 100
                        : 0;
                    const avgScore = questionResponsesData.reduce((sum, r) => sum + ((r === null || r === void 0 ? void 0 : r.score) || 0), 0) /
                        questionResponsesData.length || 0;
                    // Generate response distribution
                    const responseDistribution = this.generateResponseDistribution(questionResponsesData, question);
                    return {
                        questionId: ((_a = question._id) === null || _a === void 0 ? void 0 : _a.toString()) || "",
                        questionTitle: typeof question.title === "string" ? question.title : "Question",
                        questionType: question.type,
                        totalResponses: questionResponsesData.length,
                        correctResponses,
                        accuracy,
                        averageScore: avgScore,
                        responseDistribution,
                        commonAnswers: responseDistribution
                            .map((r) => r.option)
                            .slice(0, 5),
                    };
                })));
                // Generate score distribution
                const scoreDistribution = this.generateScoreDistribution(responses, form.totalscore || 100);
                // Generate time series data
                const timeSeriesData = this.generateTimeSeriesData(responses, startDate, now);
                // Generate performance metrics
                const performanceMetrics = this.generatePerformanceMetrics(responses, questions);
                const analyticsData = {
                    totalResponses,
                    completedResponses,
                    averageScore,
                    averageCompletionTime,
                    responseRate,
                    questionAnalytics,
                    scoreDistribution,
                    timeSeriesData,
                    performanceMetrics,
                };
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: analyticsData }));
            }
            catch (error) {
                console.error("Get Form Analytics Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve analytics"));
            }
        });
        // Export analytics as PDF or CSV
        this.ExportAnalytics = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { formId } = req.params;
            const { format = "pdf" } = req.query;
            const user = req.user;
            // Check if user is authenticated
            if (!user) {
                return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
            }
            try {
                const form = yield Form_model_2.default.findById(formId)
                    .populate({ path: "user", select: "email" })
                    .lean();
                if (!form) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                // Check if user has access to this form
                if (!(0, form_controller_1.hasFormAccess)(form, user.id.toString())) {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
                }
                // Get analytics data (reuse the analytics logic)
                const responses = yield Response_model_1.default.find({
                    formId: new mongoose_1.Types.ObjectId(formId),
                });
                const questions = yield Content_model_1.default.find({
                    formId: new mongoose_1.Types.ObjectId(formId),
                });
                const analyticsData = {
                    totalResponses: responses.length,
                    completedResponses: responses.filter((r) => r.completionStatus === "completed").length,
                    averageScore: responses.reduce((sum, r) => sum + (r.totalScore || 0), 0) /
                        responses.length || 0,
                    responseRate: responses.length > 0
                        ? (responses.filter((r) => r.completionStatus === "completed")
                            .length /
                            responses.length) *
                            100
                        : 0,
                    questionAnalytics: yield Promise.all(questions.map((question) => __awaiter(this, void 0, void 0, function* () {
                        const questionResponses = responses.filter((r) => r.responseset.some((rs) => { var _a; return rs.questionId.toString() === ((_a = question._id) === null || _a === void 0 ? void 0 : _a.toString()); }));
                        const questionResponsesData = questionResponses
                            .map((r) => r.responseset.find((rs) => { var _a; return rs.questionId.toString() === ((_a = question._id) === null || _a === void 0 ? void 0 : _a.toString()); }))
                            .filter(Boolean);
                        const correctResponses = questionResponsesData.filter((r) => (r === null || r === void 0 ? void 0 : r.score) && r.score > 0).length;
                        const accuracy = questionResponsesData.length > 0
                            ? (correctResponses / questionResponsesData.length) * 100
                            : 0;
                        const avgScore = questionResponsesData.reduce((sum, r) => sum + ((r === null || r === void 0 ? void 0 : r.score) || 0), 0) / questionResponsesData.length || 0;
                        return {
                            questionTitle: typeof question.title === "string"
                                ? question.title
                                : "Question",
                            questionType: question.type,
                            totalResponses: questionResponsesData.length,
                            accuracy,
                            averageScore: avgScore,
                        };
                    }))),
                    scoreDistribution: this.generateScoreDistribution(responses, form.totalscore || 100),
                    performanceMetrics: this.generatePerformanceMetrics(responses, questions),
                };
                if (format === "pdf") {
                    const PDFExportService = require("../services/PDFExportService").default;
                    const pdfBuffer = yield PDFExportService.generateAnalyticsPDF(analyticsData, form.title);
                    res.setHeader("Content-Type", "application/pdf");
                    res.setHeader("Content-Disposition", `attachment; filename="${form.title}-analytics.pdf"`);
                    res.send(pdfBuffer);
                }
                else if (format === "csv") {
                    const csvData = this.generateCSVData(analyticsData, responses);
                    res.setHeader("Content-Type", "text/csv");
                    res.setHeader("Content-Disposition", `attachment; filename="${form.title}-analytics.csv"`);
                    res.send(csvData);
                }
                else {
                    res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid export format"));
                }
            }
            catch (error) {
                console.error("Export Analytics Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to export analytics"));
            }
        });
        // Get all responses by current user
        this.GetUserResponses = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const user = req.user;
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 10;
            if (!user) {
                return res.status(401).json((0, helper_1.ReturnCode)(401, "User not authenticated"));
            }
            try {
                const skip = (page - 1) * limit;
                // Get all responses by the user with form details
                const responses = yield Response_model_1.default.find({
                    userId: new mongoose_1.Types.ObjectId(user.id),
                })
                    .populate({
                    path: "formId",
                    select: "title type setting user createdAt",
                })
                    .sort({ submittedAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean();
                const totalCount = yield Response_model_1.default.countDocuments({
                    userId: new mongoose_1.Types.ObjectId(user.id),
                });
                const formattedResponses = responses.map((response) => {
                    var _a;
                    const form = response.formId;
                    return {
                        _id: response._id,
                        formId: (form === null || form === void 0 ? void 0 : form._id) || response.formId,
                        formTitle: (form === null || form === void 0 ? void 0 : form.title) || "Unknown Form",
                        formType: (form === null || form === void 0 ? void 0 : form.type) || "Unknown",
                        totalScore: response.totalScore,
                        maxScore: (form === null || form === void 0 ? void 0 : form.totalscore) || 0,
                        isCompleted: response.isCompleted,
                        submittedAt: response.submittedAt,
                        createdAt: response.createdAt,
                        responseCount: ((_a = response.responseset) === null || _a === void 0 ? void 0 : _a.length) || 0,
                        isAutoScored: response.isAutoScored,
                        formCreatedAt: form === null || form === void 0 ? void 0 : form.createdAt,
                    };
                });
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: {
                        responses: formattedResponses,
                        pagination: {
                            page,
                            limit,
                            totalCount,
                            totalPages: Math.ceil(totalCount / limit),
                            hasNextPage: page < Math.ceil(totalCount / limit),
                            hasPrevPage: page > 1,
                        },
                    } }));
            }
            catch (error) {
                console.error("Get User Responses Error:", error);
                res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, "Failed to retrieve user responses"));
            }
        });
    }
    deepEqual(a, b) {
        if (a === b)
            return true;
        if (typeof a !== "object" || typeof b !== "object" || !a || !b)
            return false;
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length)
            return false;
        return keysA.every((key) => Object.prototype.hasOwnProperty.call(b, key) &&
            this.deepEqual(a[key], b[key]));
    }
    // Helper method to generate CSV data
    generateCSVData(analyticsData, responses) {
        const headers = [
            "Response ID",
            "Respondent Name",
            "Respondent Email",
            "Total Score",
            "Completion Status",
            "Submitted At",
        ];
        const csvRows = [headers.join(",")];
        responses.forEach((response) => {
            const row = [
                response._id,
                response.respondentName || "N/A",
                response.respondentEmail || "N/A",
                response.totalScore || 0,
                response.completionStatus || "partial",
                response.submittedAt
                    ? new Date(response.submittedAt).toISOString()
                    : "N/A",
            ];
            csvRows.push(row.join(","));
        });
        return csvRows.join("\n");
    }
    // Helper method to generate response distribution
    generateResponseDistribution(responses, question) {
        const distribution = {};
        responses.forEach((response) => {
            if (response === null || response === void 0 ? void 0 : response.response) {
                const answer = Array.isArray(response.response)
                    ? response.response.join(", ")
                    : response.response.toString();
                distribution[answer] = (distribution[answer] || 0) + 1;
            }
        });
        return Object.entries(distribution)
            .map(([option, count]) => ({
            option,
            count,
            percentage: (count / responses.length) * 100,
        }))
            .sort((a, b) => b.count - a.count);
    }
    // Helper method to generate score distribution
    generateScoreDistribution(responses, maxScore) {
        const ranges = [
            { min: 0, max: 0.2 * maxScore, label: "0-20%" },
            { min: 0.2 * maxScore, max: 0.4 * maxScore, label: "21-40%" },
            { min: 0.4 * maxScore, max: 0.6 * maxScore, label: "41-60%" },
            { min: 0.6 * maxScore, max: 0.8 * maxScore, label: "61-80%" },
            { min: 0.8 * maxScore, max: maxScore, label: "81-100%" },
        ];
        return ranges.map((range) => {
            const count = responses.filter((r) => (r.totalScore || 0) >= range.min && (r.totalScore || 0) <= range.max).length;
            return {
                scoreRange: range.label,
                count,
                percentage: responses.length > 0 ? (count / responses.length) * 100 : 0,
            };
        });
    }
    // Helper method to generate time series data
    generateTimeSeriesData(responses, startDate, endDate) {
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
        const data = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
            const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
            const dayResponses = responses.filter((r) => r.createdAt >= dayStart && r.createdAt < dayEnd);
            const avgScore = dayResponses.length > 0
                ? dayResponses.reduce((sum, r) => sum + (r.totalScore || 0), 0) /
                    dayResponses.length
                : 0;
            data.push({
                date: date.toISOString().split("T")[0],
                responses: dayResponses.length,
                averageScore: avgScore,
            });
        }
        return data;
    }
    // Helper method to generate performance metrics
    generatePerformanceMetrics(responses, questions) {
        // Top performers
        const topPerformers = responses
            .filter((r) => r.respondentName && r.respondentEmail)
            .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
            .slice(0, 5)
            .map((r) => ({
            name: r.respondentName,
            email: r.respondentEmail,
            score: r.totalScore || 0,
            completionTime: 8, // Mock completion time
        }));
        // Difficult questions (lowest accuracy)
        const difficultQuestions = questions
            .map((q) => {
            var _a;
            const questionResponses = responses.filter((r) => r.responseset.some((rs) => { var _a; return rs.questionId.toString() === ((_a = q._id) === null || _a === void 0 ? void 0 : _a.toString()); }));
            const correctCount = questionResponses.filter((r) => {
                const questionResponse = r.responseset.find((rs) => { var _a; return rs.questionId.toString() === ((_a = q._id) === null || _a === void 0 ? void 0 : _a.toString()); });
                return (questionResponse &&
                    questionResponse.score &&
                    questionResponse.score > 0);
            }).length;
            const accuracy = questionResponses.length > 0
                ? (correctCount / questionResponses.length) * 100
                : 0;
            const avgScore = questionResponses.reduce((sum, r) => {
                const questionResponse = r.responseset.find((rs) => { var _a; return rs.questionId.toString() === ((_a = q._id) === null || _a === void 0 ? void 0 : _a.toString()); });
                return sum + ((questionResponse === null || questionResponse === void 0 ? void 0 : questionResponse.score) || 0);
            }, 0) / questionResponses.length || 0;
            return {
                questionId: ((_a = q._id) === null || _a === void 0 ? void 0 : _a.toString()) || "",
                title: typeof q.title === "string" ? q.title : "Question",
                accuracy,
                averageScore: avgScore,
            };
        })
            .sort((a, b) => a.accuracy - b.accuracy)
            .slice(0, 5);
        return {
            topPerformers,
            difficultQuestions,
        };
    }
}
exports.FormResponseController = FormResponseController;
FormResponseController.DEFAULT_PAGE = 1;
FormResponseController.DEFAULT_LIMIT = 5;
FormResponseController.responseValidate = zod_1.default.object({
    body: zod_1.default.object({
        formId: zod_1.default.string().min(1, "Form is required"),
        responseset: zod_1.default.array(zod_1.default.object({
            questionId: zod_1.default.string().min(1, "Question is required"),
            response: zod_1.default.any(),
        })).nonempty("Responseset cannot be empty"),
    }),
});
// Public form submission validation
FormResponseController.publicSubmitValidate = zod_1.default.object({
    body: zod_1.default.object({
        formId: zod_1.default.string().min(1, "Form is required"),
        responses: zod_1.default.array(zod_1.default.object({
            questionId: zod_1.default.string().min(1, "Question is required"),
            response: zod_1.default.any(),
        })).nonempty("Responses cannot be empty"),
        respondentEmail: zod_1.default.string().email().optional(),
        respondentName: zod_1.default.string().optional(),
    }),
});
exports.default = new FormResponseController();
