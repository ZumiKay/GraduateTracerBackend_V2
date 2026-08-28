import { ContentType } from "../../model/Content.model";
import {
  AddQuestionNumbering,
  MAX_QUESTION_DEPTH,
  getQuestionDepth,
  validateNestingDepth,
} from "../helper";
import { MockContentFactory } from "../mockdata";

//Helpers
const ids = (questions: ContentType[]) =>
  AddQuestionNumbering({ questions }).map((q) => q.questionId);

/** Build expected labels.
 *  e.g. depth 4 → ["1", "1.1", "1.1.1", "1.1.1.1"]
 */
function linearChainLabels(depth: number): string[] {
  const labels: string[] = ["1"];
  for (let i = 1; i < depth; i++) {
    labels.push(labels[i - 1] + ".1");
  }
  return labels;
}

//Tests
describe("AddQuestionNumbering", () => {
  const formId = MockContentFactory.createFormId();

  describe("Basic cases", () => {
    test("returns [] for empty input", () => {
      expect(AddQuestionNumbering({ questions: [] })).toStrictEqual([]);
    });

    test("three flat top-level questions → '1', '2', '3'", () => {
      const qs = [
        MockContentFactory.createMultipleChoiceContent({ formId, qIdx: 0 }),
        MockContentFactory.createCheckboxContent({ formId, qIdx: 1 }),
        MockContentFactory.createTextContent({ formId, qIdx: 2 }),
      ];
      expect(ids(qs)).toStrictEqual(["1", "2", "3"]);
    });
  });

  //LastIdx pagination numbering
  describe("lastIdx offset (pagination)", () => {
    test("lastIdx=5 shifts top-level numbering to start at 6", () => {
      const qs = [
        MockContentFactory.createMultipleChoiceContent({ formId, qIdx: 0 }),
        MockContentFactory.createCheckboxContent({ formId, qIdx: 1 }),
      ];
      const result = AddQuestionNumbering({ questions: qs, lastIdx: 5 }).map(
        (q) => q.questionId,
      );
      expect(result).toStrictEqual(["6", "7"]);
    });

    test("using lastIdx as nested numbering", () => {
      const chain = MockContentFactory.createNestedContent({
        depth: 3,
        formId,
      });
      const result = AddQuestionNumbering({
        questions: chain,
        lastIdx: 2,
      }).map((q) => q.questionId);
      expect(result).toStrictEqual(["3", "3.1", "3.1.1"]);
    });
  });

  //Nesting testing single triggerKey

  describe("Normal nesting | Single Branch", () => {
    test.each([2, 3, 4])("depth %i produces correct linear chain", (depth) => {
      const chain = MockContentFactory.createNestedContent({ depth, formId });
      expect(ids(chain)).toStrictEqual(linearChainLabels(depth));
    });

    test("different single tirggerKey (optionsIdx) still the same numbering -> 1 , 1.1", () => {
      const chain = MockContentFactory.createNestedContent({
        depth: 2,
        formId,
        triggerKey: 2,
      });
      expect(ids(chain)).toStrictEqual(["1", "1.1"]);
    });
  });

  describe("Medium nesting | Single Branch", () => {
    test.each([5, 6, 7, 8, 9, 10])(
      "depth %i produces correct linear chain",
      (depth) => {
        const chain = MockContentFactory.createNestedContent({ depth, formId });
        expect(ids(chain)).toStrictEqual(linearChainLabels(depth));
      },
    );
  });

  describe("Deep nesting | Single Branch", () => {
    test.each([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])(
      "depth %i produces correct linear chain",
      (depth) => {
        const chain = MockContentFactory.createNestedContent({ depth, formId });
        const result = ids(chain);
        expect(result.length).toBe(depth);
        expect(result).toStrictEqual(linearChainLabels(depth));
      },
    );

    test("depth guard for exceed maximuim (20) passed (99)", () => {
      const chain = MockContentFactory.createNestedContent({
        depth: 99,
        formId,
      });
      expect(chain.length).toBe(20);
      expect(ids(chain)).toStrictEqual(linearChainLabels(20));
    });
  });

  //

  describe("Sibling / multi-branch numbering", () => {
    test("two independent depth-2 chains produce '1', '1.1', '2', '2.1'", () => {
      const chain1 = MockContentFactory.createNestedContent({
        depth: 2,
        formId,
        startQIdx: 0,
      });
      const chain2 = MockContentFactory.createNestedContent({
        depth: 2,
        formId,
        startQIdx: 10,
      });
      // Combine: root1, child1, root2, child2
      const combined = [chain1[0], chain1[1], chain2[0], chain2[1]];
      expect(ids(combined)).toStrictEqual(["1", "1.1", "2", "2.1"]);
    });

    test("depth-3 chain followed by a flat question → '1','1.1','1.1.1','2'", () => {
      const chain = MockContentFactory.createNestedContent({
        depth: 3,
        formId,
        startQIdx: 0,
      });
      const flat = MockContentFactory.createTextContent({
        formId,
        qIdx: 100,
      });
      expect(ids([...chain, flat])).toStrictEqual(["1", "1.1", "1.1.1", "2"]);
    });
  });
});

describe("validateNestingDepth", () => {
  const formId = MockContentFactory.createFormId();

  test("returns null for empty array", () => {
    expect(validateNestingDepth([])).toBeNull();
  });

  test("returns null for a single flat question", () => {
    const q = MockContentFactory.createMultipleChoiceContent({ formId });
    expect(validateNestingDepth([q])).toBeNull();
  });

  test("returns null for multiple flat questions", () => {
    const qs = [
      MockContentFactory.createMultipleChoiceContent({ formId, qIdx: 0 }),
      MockContentFactory.createCheckboxContent({ formId, qIdx: 1 }),
      MockContentFactory.createTextContent({ formId, qIdx: 2 }),
    ];
    expect(validateNestingDepth(qs)).toBeNull();
  });

  //Test within the allowed depth
  test.each(Array.from({ length: MAX_QUESTION_DEPTH }, (_, i) => i + 1))(
    "depth %i is within limit → null",
    (depth) => {
      const chain = MockContentFactory.createNestedContent({ depth, formId });
      expect(validateNestingDepth(chain)).toBeNull();
    },
  );

  //Exceed Error Validation
  test("depth 21 (one over limit) returns an error string", () => {
    const chain20 = MockContentFactory.createNestedContent({
      depth: 20,
      formId,
    });
    const leaf = chain20[19];
    // Manually attach one child below the leaf
    const extraChild = MockContentFactory.createMultipleChoiceContent({
      formId,
      qIdx: 999,
      parentcontent: {
        _id: leaf._id!.toString(),
        qId: leaf._id!.toString(),
        qIdx: leaf.qIdx,
        optIdx: 0,
      },
    });
    const result = validateNestingDepth([...chain20, extraChild]);
    expect(result).not.toBeNull();
    expect(result).toMatch(/exceeds maximum depth of 20/);
    expect(result).toMatch(/depth 21/);
  });

  test("custom maxDepth=3: depth-4 chain is rejected", () => {
    const chain = MockContentFactory.createNestedContent({ depth: 4, formId });
    const result = validateNestingDepth(chain, 3);
    expect(result).not.toBeNull();
    expect(result).toMatch(/exceeds maximum depth of 3/);
  });

  test("custom maxDepth=3: depth-3 chain is accepted", () => {
    const chain = MockContentFactory.createNestedContent({ depth: 3, formId });
    expect(validateNestingDepth(chain, 3)).toBeNull();
  });

  describe("getQuestionDepth", () => {
    function buildMaps(questions: ContentType[]) {
      const byId = new Map<string, ContentType>();
      const byQIdx = new Map<number, ContentType>();
      for (const q of questions) {
        if (q._id) byId.set(q._id.toString(), q);
        if (q.qIdx !== undefined) byQIdx.set(q.qIdx, q);
      }
      return { byId, byQIdx };
    }

    test("top-level question has depth 1", () => {
      const q = MockContentFactory.createMultipleChoiceContent({ formId });
      const { byId, byQIdx } = buildMaps([q]);
      expect(getQuestionDepth(q, byId, byQIdx)).toBe(1);
    });

    test.each([
      [2, 2],
      [5, 5],
      [10, 10],
      [15, 15],
      [20, 20],
    ])(
      "Question with testing depth (%i) is indeed has depth %i",
      (questionNumber, depth) => {
        const chain = MockContentFactory.createNestedContent({ depth, formId });
        const { byId, byQIdx } = buildMaps(chain);
        expect(getQuestionDepth(chain[depth - 1], byId, byQIdx)).toBe(depth);
      },
    );

    test("When parent question is missing reports depth 1", () => {
      const parent = MockContentFactory.createMultipleChoiceContent({
        formId,
        qIdx: 0,
      });
      const child = MockContentFactory.createMultipleChoiceContent({
        formId,
        qIdx: 1,
        parentcontent: {
          _id: parent._id!.toString(),
          qId: parent._id!.toString(),
          qIdx: parent.qIdx,
          optIdx: 0,
        },
      });
      // Only child is in the map — parent is missing → depth falls back to 1
      const { byId, byQIdx } = buildMaps([child]);
      expect(getQuestionDepth(child, byId, byQIdx)).toBe(1);
    });
  });
});
