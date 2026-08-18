import { Types } from "mongoose";
import {
  formatResponseValue,
  hasFormAccess,
  isPrimaryOwner,
  isValidObjectIdString,
  validateAccess,
  validateFormRequest,
  verifyRole,
} from "../formHelpers";
import {
  CollaboratorType,
  FormType,
  SubmitType,
  TypeForm,
} from "../../model/Form.model";
import { QuestionType } from "../../model/Content.model";

describe("formHelpers", () => {
  const createObjectId = () => new Types.ObjectId();

  const createMockForm = (overrides: Partial<FormType> = {}): FormType => {
    return {
      _id: createObjectId(),
      title: "Sample Test Form",
      type: TypeForm.Normal,
      submittype: SubmitType.Once,
      user: createObjectId(),
      owners: [],
      editors: [],
      pendingCollarborators: [],
      ...overrides,
    };
  };

  describe("hasFormAccess", () => {
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    test("should return true when user is the primary creator", () => {
      const creatorId = createObjectId();
      const form = createMockForm({ user: creatorId });

      expect(hasFormAccess(form, creatorId)).toBe(true);
    });

    test("should return true when user is in the editors list", () => {
      const creatorId = createObjectId();
      const editorId = createObjectId();
      const form = createMockForm({
        user: creatorId,
        editors: [{ _id: editorId } as any],
      });

      expect(hasFormAccess(form, editorId)).toBe(true);
    });

    test("should return true when user is in the owners list", () => {
      const creatorId = createObjectId();
      const ownerId = createObjectId();
      const form = createMockForm({
        user: creatorId,
        owners: [{ _id: ownerId } as any],
      });

      expect(hasFormAccess(form, ownerId)).toBe(true);
    });

    test("should return false if user has no access", () => {
      const creatorId = createObjectId();
      const toBeTestId = createObjectId();
      const form = createMockForm({
        user: creatorId,
        owners: [createObjectId()],
        editors: [createObjectId()],
      });

      expect(hasFormAccess(form, toBeTestId)).toBe(false);
    });

    test("should return false when editors and owners arrays are undefined and user is not creator", () => {
      const creatorId = createObjectId();
      const otherUserId = createObjectId();
      const form = createMockForm({
        user: creatorId,
        owners: undefined,
        editors: undefined,
      });

      expect(hasFormAccess(form, otherUserId)).toBe(false);
    });

    test("should return false and catch error form object", () => {
      expect(hasFormAccess(null as any, createObjectId())).toBe(false);
      expect(hasFormAccess({} as any, createObjectId())).toBe(false);
    });
  });

  describe("isPrimaryOwner", () => {
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    test("should return true when form.user is an ObjectId matching userId", () => {
      const creatorId = createObjectId();
      const form = createMockForm({ user: creatorId });

      expect(isPrimaryOwner(form, creatorId.toString())).toBe(true);
    });

    test("should return true when form.user is a populated object with _id matching userId", () => {
      const creatorId = createObjectId();
      const form = createMockForm({
        user: { _id: creatorId } as any,
      });

      expect(isPrimaryOwner(form, creatorId.toString())).toBe(true);
    });

    test("should return true when form.user is a string matching userId", () => {
      const creatorIdStr = createObjectId().toString();
      const form = createMockForm({
        user: creatorIdStr as any,
      });

      expect(isPrimaryOwner(form, creatorIdStr)).toBe(true);
    });

    test("should return false when userId does not match form.user", () => {
      const creatorId = createObjectId();
      const otherUserIdStr = createObjectId().toString();
      const form = createMockForm({ user: creatorId });

      expect(isPrimaryOwner(form, otherUserIdStr)).toBe(false);
    });

    test("should return false when form.user is null or undefined", () => {
      const form = createMockForm({ user: null as any });
      expect(isPrimaryOwner(form, createObjectId().toString())).toBe(false);
    });

    test("should return false and catch error if form is null", () => {
      expect(isPrimaryOwner(null as any, "some-id")).toBe(false);
    });
  });

  describe("verifyRole", () => {
    test("should verify creator role correctly", () => {
      const creatorId = createObjectId();
      const otherId = createObjectId();
      const form = createMockForm({ user: creatorId });

      expect(verifyRole(CollaboratorType.creator, form, creatorId)).toBe(true);
      expect(verifyRole(CollaboratorType.creator, form, otherId)).toBe(false);
    });

    test("should verify editor role correctly", () => {
      const editorId = createObjectId();
      const otherId = createObjectId();
      const form = createMockForm({ editors: [editorId] });

      expect(verifyRole(CollaboratorType.editor, form, editorId)).toBe(true);
      expect(verifyRole(CollaboratorType.editor, form, otherId)).toBe(false);
    });

    test("should verify owner role correctly", () => {
      const ownerId = createObjectId();
      const otherId = createObjectId();
      const form = createMockForm({ owners: [ownerId] });

      expect(verifyRole(CollaboratorType.owner, form, ownerId)).toBe(true);
      expect(verifyRole(CollaboratorType.owner, form, otherId)).toBe(false);
    });

    test("should return false if editors or owners list is undefined", () => {
      const userId = createObjectId();
      const form = createMockForm({ editors: undefined, owners: undefined });

      expect(verifyRole(CollaboratorType.editor, form, userId)).toBe(false);
      expect(verifyRole(CollaboratorType.owner, form, userId)).toBe(false);
    });
  });

  describe("validateAccess", () => {
    test("should return full access breakdown for primary creator", () => {
      const creatorId = createObjectId();
      const form = createMockForm({ user: creatorId });

      const result = validateAccess(form, creatorId);
      expect(result).toEqual({
        hasAccess: true,
        isCreator: true,
        isOwner: false,
        isEditor: false,
      });
    });

    test("should return full access breakdown for additional owner", () => {
      const creatorId = createObjectId();
      const ownerId = createObjectId();
      const form = createMockForm({
        user: creatorId,
        owners: [ownerId],
      });

      const result = validateAccess(form, ownerId);
      expect(result).toEqual({
        hasAccess: true,
        isCreator: false,
        isOwner: true,
        isEditor: false,
      });
    });

    test("should return full access breakdown for editor", () => {
      const creatorId = createObjectId();
      const editorId = createObjectId();
      const form = createMockForm({
        user: creatorId,
        editors: [editorId],
      });

      const result = validateAccess(form, editorId);
      expect(result).toEqual({
        hasAccess: true,
        isCreator: false,
        isOwner: false,
        isEditor: true,
      });
    });

    test("should return hasAccess: false when user is not associated with form", () => {
      const creatorId = createObjectId();
      const strangerId = createObjectId();
      const form = createMockForm({
        user: creatorId,
        owners: [createObjectId()],
        editors: [createObjectId()],
      });

      const result = validateAccess(form, strangerId);
      expect(result).toEqual({
        hasAccess: false,
        isCreator: false,
        isOwner: false,
        isEditor: false,
      });
    });

    test("should handle user being both creator and listed in owners", () => {
      const creatorId = createObjectId();
      const form = createMockForm({
        user: creatorId,
        owners: [creatorId],
      });

      const result = validateAccess(form, creatorId);
      expect(result).toEqual({
        hasAccess: true,
        isCreator: true,
        isOwner: true,
        isEditor: false,
      });
    });
  });

  describe("isValidObjectIdString", () => {
    test("should return true for valid 24-character hexadecimal ObjectId strings", () => {
      expect(isValidObjectIdString("507f1f77bcf86cd799439011")).toBe(true);
      expect(isValidObjectIdString(new Types.ObjectId().toString())).toBe(true);
    });

    test("should return false for invalid ObjectId strings", () => {
      expect(isValidObjectIdString("invalid-id")).toBe(false);
      expect(isValidObjectIdString("507f1f77bcf86cd79943901")).toBe(false); // 23 chars
      expect(isValidObjectIdString("507f1f77bcf86cd7994390112")).toBe(false); // 25 chars
      expect(isValidObjectIdString("507f1f77bcf86cd79943901z")).toBe(false); // non-hex 'z'
      expect(isValidObjectIdString("")).toBe(false);
      expect(isValidObjectIdString(null as any)).toBe(false);
      expect(isValidObjectIdString(12345 as any)).toBe(false);
    });
  });

  describe("validateFormRequest", () => {
    test("should return isValid: true when formId is valid and userId is omitted", () => {
      const formId = new Types.ObjectId().toString();
      expect(validateFormRequest(formId)).toEqual({ isValid: true });
    });

    test("should return isValid: true when both formId and userId are valid", () => {
      const formId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();
      expect(validateFormRequest(formId, userId)).toEqual({ isValid: true });
    });

    test("should return error when formId is empty or missing", () => {
      expect(validateFormRequest("")).toEqual({
        isValid: false,
        error: "Form ID is required",
      });
      expect(validateFormRequest(null as any)).toEqual({
        isValid: false,
        error: "Form ID is required",
      });
    });

    test("should return error when formId format is invalid", () => {
      expect(validateFormRequest("bad-form-id")).toEqual({
        isValid: false,
        error: "Invalid form ID format",
      });
    });

    test("should return error when userId format is invalid", () => {
      const formId = new Types.ObjectId().toString();
      expect(validateFormRequest(formId, "bad-user-id")).toEqual({
        isValid: false,
        error: "Invalid user ID format",
      });
    });
  });

  describe("formatResponseValue", () => {
    test("should format QuestionType.Date response to dd-mm-yyyy", () => {
      const dateStr = "2024-05-15T00:00:00.000Z";
      const result = formatResponseValue({
        response: dateStr,
        questionType: QuestionType.Date,
      });

      expect(result).toBe("15-05-2024");
    });

    test("should format QuestionType.RangeDate start and end to dd-mm-yyyy", () => {
      const result = formatResponseValue({
        response: {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-12-31T00:00:00.000Z",
        } as any,
        questionType: QuestionType.RangeDate,
      });

      expect(result).toEqual({
        start: "01-01-2024",
        end: "31-12-2024",
      });
    });

    test("should return non-date response values as-is", () => {
      expect(
        formatResponseValue({
          response: "Some text answer",
          questionType: QuestionType.Text,
        }),
      ).toBe("Some text answer");

      expect(
        formatResponseValue({
          response: 2,
          questionType: QuestionType.MultipleChoice,
        }),
      ).toBe(2);

      expect(
        formatResponseValue({
          response: [0, 1],
          questionType: QuestionType.CheckBox,
        }),
      ).toEqual([0, 1]);
    });
  });
});
