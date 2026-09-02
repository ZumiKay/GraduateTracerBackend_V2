import { Types } from "mongoose";
import {
  ChoiceQuestionType,
  ContentType,
  ParentContentType,
  QuestionType,
  RangeType,
} from "../model/Content.model";

import {
  ResponseAnswerType,
  ResponseSetType,
  ScoringMethod,
} from "../model/Response.model";
import {
  FormType,
  returnscore,
  SubmitType,
  TypeForm,
} from "../model/Form.model";

export class MockContentFactory {
  static createFormId(): Types.ObjectId {
    return new Types.ObjectId();
  }

  static createContentTitle(text: string = "Sample Question") {
    return {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text }],
        },
      ],
    };
  }

  static createChoiceOptions(count: number = 3): ChoiceQuestionType[] {
    return Array.from({ length: count }, (_, idx) => ({
      _id: new Types.ObjectId(),
      idx,
      content: `Option ${idx + 1}`,
    }));
  }

  static createMultipleChoiceContent(
    overrides?: Partial<ContentType>,
  ): ContentType {
    const choices = this.createChoiceOptions(4);
    return {
      _id: new Types.ObjectId(),
      title: this.createContentTitle(
        "What is your favorite programming language?",
      ),
      type: QuestionType.MultipleChoice,
      qIdx: 0,
      formId: this.createFormId(),
      multiple: choices,
      score: 10,
      answer: {
        _id: new Types.ObjectId(),
        answer: 0,
        isCorrect: true,
      },
      require: true,
      page: 1,
      hasAnswer: true,
      isValidated: true,
      ...overrides,
    };
  }

  static createCheckboxContent(overrides?: Partial<ContentType>): ContentType {
    const choices = this.createChoiceOptions(5);
    return {
      _id: new Types.ObjectId(),
      title: this.createContentTitle(
        "Select all programming languages you know",
      ),
      type: QuestionType.CheckBox,
      qIdx: 1,
      formId: this.createFormId(),
      checkbox: choices,
      score: 15,
      answer: {
        _id: new Types.ObjectId(),
        answer: [0, 1, 3], // Multiple correct answers
        isCorrect: true,
      },
      require: false,
      page: 1,
      hasAnswer: true,
      isValidated: true,
      ...overrides,
    };
  }

  static createTextContent(overrides?: Partial<ContentType>): ContentType {
    return {
      _id: new Types.ObjectId(),
      title: this.createContentTitle("What is your full name?"),
      type: QuestionType.Text,
      qIdx: 2,
      formId: this.createFormId(),
      text: "",
      score: 0,
      require: true,
      page: 1,
      hasAnswer: false,
      isValidated: false,
      ...overrides,
    };
  }

  static createShortAnswerContent(
    overrides?: Partial<ContentType>,
  ): ContentType {
    return {
      _id: new Types.ObjectId(),
      title: this.createContentTitle("Explain the concept of polymorphism"),
      type: QuestionType.ShortAnswer,
      qIdx: 3,
      formId: this.createFormId(),
      text: "",
      score: 20,
      answer: {
        _id: new Types.ObjectId(),
        answer: "polymorphism is the ability of objects to take multiple forms",
        isCorrect: true,
      },
      require: true,
      page: 2,
      hasAnswer: true,
      isValidated: false, // Usually requires manual validation
      ...overrides,
    };
  }

  static createNumberContent(overrides?: Partial<ContentType>): ContentType {
    return {
      _id: new Types.ObjectId(),
      title: this.createContentTitle(
        "How many years of programming experience do you have?",
      ),
      type: QuestionType.Number,
      qIdx: 4,
      formId: this.createFormId(),
      score: 5,
      answer: {
        _id: new Types.ObjectId(),
        answer: 5,
        isCorrect: true,
      },
      require: false,
      page: 2,
      hasAnswer: true,
      isValidated: true,
      ...overrides,
    };
  }

  static createDateContent(overrides?: Partial<ContentType>): ContentType {
    return {
      _id: new Types.ObjectId(),
      title: this.createContentTitle("When did you start programming?"),
      type: QuestionType.Date,
      qIdx: 5,
      formId: this.createFormId(),
      date: new Date(),
      score: 0,
      answer: {
        _id: new Types.ObjectId(),
        answer: new Date("2020-01-01") as unknown as ResponseAnswerType,
        isCorrect: true,
      },
      require: false,
      page: 2,
      hasAnswer: true,
      isValidated: true,
      ...overrides,
    };
  }

  static createRangeNumberContent(
    overrides?: Partial<ContentType>,
  ): ContentType {
    return {
      _id: new Types.ObjectId(),
      title: this.createContentTitle("Select your salary range (in thousands)"),
      type: QuestionType.RangeNumber,
      qIdx: 6,
      formId: this.createFormId(),
      rangenumber: { start: 0, end: 200 },
      score: 0,
      answer: {
        _id: new Types.ObjectId(),
        answer: { start: 50, end: 100 } as RangeType<number>,
        isCorrect: true,
      },
      require: false,
      page: 3,
      hasAnswer: true,
      isValidated: true,
      ...overrides,
    };
  }

  static createRangeDateContent(overrides?: Partial<ContentType>): ContentType {
    return {
      _id: new Types.ObjectId(),
      title: this.createContentTitle("Select your project duration"),
      type: QuestionType.RangeDate,
      qIdx: 7,
      formId: this.createFormId(),
      rangedate: {
        start: new Date("2024-01-01"),
        end: new Date("2024-12-31"),
      },
      score: 0,
      answer: {
        _id: new Types.ObjectId(),
        answer: {
          start: new Date("2024-03-01"),
          end: new Date("2024-09-01"),
        } as never,
        isCorrect: true,
      },
      require: false,
      page: 3,
      hasAnswer: true,
      isValidated: true,
      ...overrides,
    };
  }

  static createSelectionContent(overrides?: Partial<ContentType>): ContentType {
    const choices = this.createChoiceOptions(3);
    return {
      _id: new Types.ObjectId(),
      title: this.createContentTitle("Choose your preferred IDE"),
      type: QuestionType.Selection,
      qIdx: 8,
      formId: this.createFormId(),
      selection: choices,
      score: 5,
      answer: {
        _id: new Types.ObjectId(),
        answer: 1, // Single selection
        isCorrect: true,
      },
      require: true,
      page: 3,
      hasAnswer: true,
      isValidated: true,
      ...overrides,
    };
  }

  static createParagraphContent(overrides?: Partial<ContentType>): ContentType {
    return {
      _id: new Types.ObjectId(),
      title: this.createContentTitle(
        "Describe your biggest programming project",
      ),
      type: QuestionType.Paragraph,
      qIdx: 9,
      formId: this.createFormId(),
      text: "",
      score: 25,
      answer: {
        _id: new Types.ObjectId(),
        answer:
          "A comprehensive e-commerce platform built with React and Node.js",
        isCorrect: true,
      },
      require: false,
      page: 4,
      hasAnswer: true,
      isValidated: false, // Usually requires manual validation
      ...overrides,
    };
  }

  static createConditionQuestionWithChilds({
    parent,
    childs,
    childKey,
  }: {
    parent: ContentType;
    childs: Array<ContentType>;
    childKey?: Array<number>; //Modify responsible child by arr Idx
  }): Array<Partial<ContentType>> {
    const parentQ = {
      ...parent,
      conditional: childs.map((c, idx) => ({
        _id: new Types.ObjectId(),
        contentId: c._id as Types.ObjectId,
        key: childKey?.[idx] !== undefined ? childKey[idx] : idx,
      })),
    };
    return [
      parentQ,
      ...childs.map(
        (child, idx) =>
          ({
            ...child,
            parentcontent: {
              _id: new Types.ObjectId().toString(),
              qId: parent._id ? parent._id.toString() : `temp_${parent.qIdx}`,
              qIdx: parent.qIdx,
              optIdx: parentQ.conditional[idx].key,
            },
          }) as never,
      ),
    ];
  }

  /**
 
   * @param depth          - How many levels to generate (1 = root only, max 20)
   * @param formId         - Shared formId for all nodes (generated if omitted)
   * @param startQIdx      - qIdx for the root; children increment from there
   * @param optionCount    - Number of choice options per node
   * @param triggerKey     - Which option index (key) triggers the child at each level
   * @param parentOverrides - Partial<ContentType> applied only to the root node
   * @param childOverrides  - Array of Partial<ContentType> indexed by depth (0 = root).
   *                          Entries beyond the array length are ignored.
   */
  static createNestedContent({
    depth = 1,
    formId,
    startQIdx = 0,
    optionCount = 3,
    triggerKey = 0,
    parentOverrides,
    childOverrides = [],
  }: {
    depth?: number;
    formId?: Types.ObjectId;
    startQIdx?: number;
    optionCount?: number;
    triggerKey?: number;
    parentOverrides?: Partial<ContentType>;
    childOverrides?: Partial<ContentType>[];
  } = {}): ContentType[] {
    const MAX_DEPTH = 20;
    const clampedDepth = Math.min(Math.max(depth, 1), MAX_DEPTH);
    const sharedFormId = formId ?? this.createFormId();
    const result: ContentType[] = [];

    let parentNode: ContentType | null = null;

    for (let level = 0; level < clampedDepth; level++) {
      const nodeId = new Types.ObjectId();
      const qIdx = startQIdx + level;
      const choices = this.createChoiceOptions(optionCount);

      // Build parentcontent linking back to the previous level's node
      const parentcontent: ParentContentType | undefined = parentNode
        ? {
            _id: parentNode._id!.toString(),
            qId: parentNode._id!.toString(),
            qIdx: parentNode.qIdx,
            optIdx: triggerKey,
            ...(level === 1 ? (parentOverrides?.parentcontent ?? {}) : {}),
          }
        : undefined;

      // The previous node needs a conditional entry pointing to this new node
      if (parentNode) {
        parentNode.conditional = [
          ...(parentNode.conditional ?? []),
          {
            _id: new Types.ObjectId(),
            key: triggerKey,
            contentId: nodeId,
            contentIdx: qIdx,
          },
        ];
      }

      const levelOverride: Partial<ContentType> = childOverrides[level] ?? {};

      const node: ContentType = Object.assign(
        {
          _id: nodeId,
          title: this.createContentTitle(
            levelOverride.title
              ? ""
              : level === 0
                ? "Root Question"
                : `Child Question – Level ${level}`,
          ),
          type: QuestionType.MultipleChoice,
          multiple: choices,
          qIdx,
          formId: sharedFormId,
          page: 1,
          score: 0,
          require: false,
          hasAnswer: false,
          isValidated: false,
          conditional: [],
          ...(level === 0 ? (parentOverrides ?? {}) : {}),
          ...levelOverride,
        } as ContentType,
        // Pin structural identity fields — always wins over any override
        { _id: nodeId, qIdx, formId: sharedFormId, parentcontent },
      );

      result.push(node);
      parentNode = node;
    }

    return result;
  }

  /**
   * Simple form mock data with 10 questions across 4 pages.
   *
   * List of created questions:
   * 1. [qIdx: 0, Page 1] MultipleChoice (4 options): "What is your favorite programming language?"
   * 2. [qIdx: 1, Page 1] CheckBox (5 options): "Select all programming languages you know"
   * 3. [qIdx: 2, Page 1] Text: "What is your full name?"
   * 4. [qIdx: 3, Page 2] ShortAnswer: "Explain the concept of polymorphism"
   * 5. [qIdx: 4, Page 2] Number: "How many years of programming experience do you have?"
   * 6. [qIdx: 5, Page 2] Date: "When did you start programming?"
   * 7. [qIdx: 6, Page 3] RangeNumber: "Select your salary range (in thousands)"
   * 8. [qIdx: 7, Page 3] RangeDate: "Select your project duration"
   * 9. [qIdx: 8, Page 3] Selection (3 options): "Choose your preferred IDE"
   * 10. [qIdx: 9, Page 4] Paragraph: "Describe your biggest programming project"
   *
   * @returns Array of 10 ContentType questions sharing a common formId
   */
  static createSampleForm(
    newFormId?: Types.ObjectId,
    additional?: ContentType[],
  ): ContentType[] {
    const formId = newFormId ?? this.createFormId();

    const multipleChoice = this.createMultipleChoiceContent({
      formId,
      qIdx: 0,
    });
    const checkbox = this.createCheckboxContent({ formId, qIdx: 1 });
    const text = this.createTextContent({ formId, qIdx: 2 });
    const shortAnswer = this.createShortAnswerContent({ formId, qIdx: 3 });
    const number = this.createNumberContent({ formId, qIdx: 4 });
    const date = this.createDateContent({ formId, qIdx: 5 });
    const rangeNumber = this.createRangeNumberContent({ formId, qIdx: 6 });
    const rangeDate = this.createRangeDateContent({ formId, qIdx: 7 });
    const selection = this.createSelectionContent({ formId, qIdx: 8 });
    const paragraph = this.createParagraphContent({ formId, qIdx: 9 });

    return [
      multipleChoice,
      checkbox,
      text,
      shortAnswer,
      number,
      date,
      rangeNumber,
      rangeDate,
      selection,
      paragraph,
      ...(additional ?? []),
    ];
  }

  // Helper method to create content for quick testing
  static createMinimalContent(
    type: QuestionType,
    overrides?: Partial<ContentType>,
  ): ContentType {
    return {
      _id: new Types.ObjectId(),
      title: this.createContentTitle(`Sample ${type} Question`),
      type,
      qIdx: 0,
      formId: this.createFormId(),
      score: 10,
      page: 1,
      hasAnswer: false,
      isValidated: false,
      ...overrides,
    };
  }

  static createFormObj(override?: FormType): Partial<FormType> {
    return {
      title: "Testing Form",
      type: TypeForm.Normal,
      submittype: SubmitType.Once,
      user: new Types.ObjectId(),
      pendingCollarborators: [],
      setting: {
        submitonce: true,
        returnscore: returnscore.partial,
        acceptResponses: false,
        email: true,
      },
      ...override,
    };
  }

  /**Function to create mock function
   * @requires Form,User,Question
   */
  static createResponseSet(
    override?: Partial<ResponseSetType>,
  ): Partial<ResponseSetType> {
    return {
      question: new Types.ObjectId(),
      response: 0,
      score: 20,
      scoringMethod: ScoringMethod.AUTO,
      ...override,
    };
  }
}
