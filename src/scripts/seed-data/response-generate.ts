import { Types } from "mongoose";
import Content, { ContentType, QuestionType } from "../../model/Content.model";
import Form, { TypeForm } from "../../model/Form.model";
import FormResponse, {
  FormResponseType,
  RespondentType,
  ResponseAnswerType,
  ResponseCompletionStatus,
  ResponseSetType,
  ScoringMethod,
} from "../../model/Response.model";
import User from "../../model/User.model";

//Randoms User_name
const USER_NAME = [
  "John",
  "Sarah",
  "Michael",
  "Emily",
  "David",
  "Jessica",
  "James",
  "Amanda",
  "Robert",
  "Michelle",
  "William",
  "Lauren",
  "Richard",
  "Jennifer",
  "Joseph",
  "Lisa",
  "Charles",
  "Karen",
  "Christopher",
  "Nancy",
  "Daniel",
  "Sandra",
  "Matthew",
  "Donna",
  "Mark",
  "Carol",
  "Donald",
  "Barbara",
  "Steven",
  "Melissa",
  "Paul",
  "Deborah",
  "Andrew",
  "Stephanie",
  "Joshua",
  "Rebecca",
  "Kenneth",
  "Sharon",
  "Kevin",
  "Laura",
  "Brian",
  "Cynthia",
  "George",
  "Kathleen",
  "Edward",
  "Amy",
  "Ronald",
  "Angela",
  "Timothy",
  "Shirley",
  "Jason",
];

//Randoms short_answers
const SHORT_ANSWERS = [
  "Very helpful and responsive",
  "Good experience overall",
  "Could use improvement",
  "Excellent service",
  "Needs better documentation",
  "Satisfied with the features",
  "Support team was great",
  "Quick resolution to issues",
  "Works as expected",
  "Sometimes slow but reliable",
];

//Base Paragraph for generated
const PARAGRAPH_ANSWERS = [
  "The service has been fantastic overall. I especially appreciate the quick response times and the helpful support team. The features are intuitive and meet my needs well.",
  "I have mixed feelings about the service. While the core functionality works well, there are some areas that could be improved, particularly the user interface and documentation.",
  "Overall a positive experience. The onboarding process was smooth and the platform is easy to use. I would recommend it to others looking for a similar solution.",
  "The product meets my expectations in most areas. However, there are opportunities to improve the reporting features and add more customization options.",
  "Great platform for our team's needs. The integration capabilities are particularly impressive and have saved us a lot of time.",
  "Decent service but the pricing model could be more flexible for small teams. The features themselves are solid and reliable.",
];

//Generate random of text base
const generateTextBaseResponse = (variant: "short" | "paragraph"): string => {
  const pool = variant === "short" ? SHORT_ANSWERS : PARAGRAPH_ANSWERS;
  return pool[Math.floor(Math.random() * pool.length)];
};

/* ----------------------------- Randomize Helpers ----------------------------- */

const randomItem = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

//Randomize array items with specify amount of items
const randomSubset = <T>(arr: T[], minCount = 1): T[] => {
  //Shuffle array items by using sort with random num -0.5 -j 0.5
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  const count = Math.max(minCount, Math.floor(Math.random() * arr.length) + 1);
  return shuffled.slice(0, Math.min(count, arr.length));
};

const randomIntBetween = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomDateBetween = (start: Date, end: Date): string => {
  const ms =
    start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(ms).toISOString().split("T")[0];
};

const randomSubmittedDate = (): Date => {
  const now = new Date();
  const daysInPast = randomIntBetween(1, 365); // Last year
  return new Date(now.getTime() - daysInPast * 24 * 60 * 60 * 1000);
};

/**
 * Generate random completion time in seconds
 * Range: 5 minutes to 8 hours (realistic form completion time)
 */
const randomCompletionTime = (): number => {
  const minSeconds = 5 * 60; // 5 minutes
  const maxSeconds = 2 * 60 * 60; // 2 hours
  return randomIntBetween(minSeconds, maxSeconds);
};

/**
 * Generate Form Responses base on each question type
 * @returns Response Answer
 */
const GenerateQuestionResponseBaseOnType = (
  data: ContentType,
): ResponseAnswerType | null => {
  switch (data.type) {
    case QuestionType.ShortAnswer:
      return generateTextBaseResponse("short");

    case QuestionType.Paragraph:
      return generateTextBaseResponse("paragraph");

    case QuestionType.MultipleChoice: {
      const options = data.multiple ?? [];
      if (options.length === 0) return null;
      return randomItem(options).idx;
    }

    case QuestionType.CheckBox: {
      const options = data.checkbox ?? [];
      if (options.length === 0) return null;
      return randomSubset(options).map((o) => o.idx);
    }

    case QuestionType.Selection: {
      const options = data.selection ?? [];
      if (options.length === 0) return null;
      return randomItem(options).idx;
    }

    case QuestionType.Number:
      return randomIntBetween(0, 1000);

    case QuestionType.Date: {
      const now = new Date();
      const twoYearsAgo = new Date(now.getFullYear() - 2, 0, 1);
      return randomDateBetween(twoYearsAgo, now);
    }

    case QuestionType.RangeDate: {
      const minDate = data.rangedate?.start
        ? new Date(data.rangedate.start)
        : new Date(new Date().getFullYear() - 2, 0, 1);
      const maxDate = data.rangedate?.end
        ? new Date(data.rangedate.end)
        : new Date();
      const midMs =
        minDate.getTime() +
        Math.random() * ((maxDate.getTime() - minDate.getTime()) / 2);
      const endMs = midMs + Math.random() * (maxDate.getTime() - midMs);
      return {
        start: new Date(midMs).toISOString().split("T")[0],
        end: new Date(endMs).toISOString().split("T")[0],
      };
    }

    case QuestionType.RangeNumber: {
      const min = data.rangenumber?.start ?? 1;
      const max = data.rangenumber?.end ?? 10;
      const start = randomIntBetween(min, max - 1);
      const end = randomIntBetween(start, max);
      return { start, end };
    }

    case QuestionType.Text:
      return null;

    default:
      return null;
  }
};

interface GenerateFormResponseOptions {
  formId: string;
  responseCount?: number;
  guestOnly?: boolean;
  allUser?: boolean;
  userOnly?: boolean;
  includeConditionQuestions?: boolean;
  multipleSubmissions?: boolean;
  addScore?: boolean;
}

type ExtractUser = { _id: Types.ObjectId; email: string; name?: string };

const createUserData = async (
  userCount: number,
): Promise<Array<ExtractUser>> => {
  const realUsers = await User.find().select("_id email name").lean();
  const needed = Math.max(0, userCount - realUsers.length);

  const shuffled = [...USER_NAME].sort(() => Math.random() - 0.5);
  const n = shuffled.length;

  //Threhold of 2000 unique name
  const getUniqueName = (idx: number): string => {
    if (idx < n) return shuffled[idx];
    const offset = idx - n;
    const first = shuffled[Math.floor(offset / n) % n];
    const second = shuffled[offset % n];
    return `${first} ${second}`;
  };

  const generatedUsers: Array<ExtractUser> = Array.from({ length: needed }).map(
    (_, idx) => {
      const name = getUniqueName(idx);
      return {
        _id: new Types.ObjectId(),
        name,
        email: `${name.toLowerCase().replace(/\s+/g, "_")}_${idx}@example.com`,
      };
    },
  );

  return [...realUsers, ...generatedUsers];
};

export const GenerateFormResponse = async (
  params: GenerateFormResponseOptions,
) => {
  const {
    formId,
    responseCount = 3,
    guestOnly,
    allUser,
    userOnly,
    multipleSubmissions = false,
    addScore,
  } = params;
  const isForm = await Form.findOne({
    _id: formId,
  })
    .select("_id title type setting totalscore")
    .lean();

  if (!isForm) {
    console.log("Can't find the form");
    return false;
  }

  if (guestOnly && !isForm.setting?.acceptGuest) {
    console.log("Guest not accept");
    return false;
  }

  // Clear existing responses for this form before seeding fresh data
  const deleted = await FormResponse.deleteMany({ formId });
  console.log(
    `Cleared ${deleted.deletedCount} existing responses for form ${formId}`,
  );

  const questions = await Content.find({ formId })
    .sort({ page: 1, qIdx: 1 })
    .lean();

  // Index every question by its _id string for O(1) parent lookup.
  const questionById = new Map<string, ContentType>();
  for (const q of questions) {
    if (q._id) questionById.set(q._id.toString(), q);
  }

  // Build trigger index from the parent's conditional array (primary source)
  // so we don't rely on parentcontent.qId format being correct.
  // key: child _id string → option index (cond.key) that triggers this child.
  const triggerByChildId = new Map<string, number>();
  for (const q of questions) {
    for (const cond of q.conditional ?? []) {
      triggerByChildId.set(cond.contentId.toString(), Number(cond.key));
    }
  }

  // Extra-score classification: conditional child whose parent has score === 0.
  const extraScoreQIds = new Set<string>();
  for (const q of questions) {
    if (!q.parentcontent) continue;
    const parentQ = questionById.get(q.parentcontent.qId?.toString() ?? "");
    if (parentQ && (parentQ.score ?? 0) === 0) {
      extraScoreQIds.add(q._id!.toString());
    }
  }

  const conditionalQIds = new Set(
    questions.filter((q) => !!q.parentcontent).map((q) => q._id!.toString()),
  );

  console.log(
    `Form ${formId}: ${questions.length} questions, ${conditionalQIds.size} conditional, ${extraScoreQIds.size} extra-score`,
  );

  if (questions.length === 0) {
    console.log("No questions found for form:", formId);
    return false;
  }

  type RespondentEntry = Pick<
    FormResponseType,
    "respondentEmail" | "respondentName" | "respondentType"
  >;

  const canSubmitMultiple = !isForm.setting?.submitonce;
  const poolSize = multipleSubmissions
    ? Math.ceil(responseCount * 0.3)
    : canSubmitMultiple
      ? Math.ceil(responseCount * 0.5)
      : responseCount;

  let pool: Array<RespondentEntry> = [];

  if (userOnly) {
    const users = await createUserData(poolSize);
    pool = users.map((u) => ({
      respondentEmail: u.email,
      respondentName: u.name,
      respondentType: RespondentType.user,
    }));
  } else if (guestOnly) {
    pool = Array.from({ length: poolSize }).map((_, idx) => ({
      respondentEmail: `guest${idx + 1}@example.com`,
      respondentName: `Guest ${idx + 1}`,
      respondentType: RespondentType.guest,
    }));
  } else if (allUser) {
    const guestCount = Math.round(poolSize * 0.3);
    const userCount = poolSize - guestCount;
    const users = await createUserData(userCount);
    pool = [
      ...users.map((u) => ({
        respondentEmail: u.email,
        respondentName: u.name,
        respondentType: RespondentType.user,
      })),
      ...Array.from({ length: guestCount }).map((_, idx) => ({
        respondentEmail: `guest${idx + 1}@example.com`,
        respondentName: `Guest ${idx + 1}`,
        respondentType: RespondentType.guest,
      })),
    ];
  }

  const respondent: Array<RespondentEntry> =
    canSubmitMultiple || multipleSubmissions
      ? Array.from({ length: responseCount }).map(() => randomItem(pool))
      : pool;

  const canAddScore = addScore && isForm.type === TypeForm.Quiz;

  const responseDocs: Partial<FormResponseType>[] = respondent
    .map((r) => {
      const respondentAnswerMap = new Map<string, ResponseAnswerType>();

      const responseset = questions
        .map((q) => {
          const qId = q._id!.toString();

          if (q.parentcontent) {
            const parentQ = questionById.get(
              q.parentcontent.qId?.toString() ?? "",
            );
            if (!parentQ) return null;

            const parentAnswer = respondentAnswerMap.get(
              parentQ._id!.toString(),
            );
            if (parentAnswer === undefined) return null;

            const triggerIdx =
              triggerByChildId.get(qId) ?? Number(q.parentcontent.optIdx);

            const triggered = Array.isArray(parentAnswer)
              ? (parentAnswer as number[]).includes(triggerIdx)
              : parentAnswer === triggerIdx;

            if (!triggered) return null;
          }

          const response = GenerateQuestionResponseBaseOnType(q);
          if (response === null) return null;

          respondentAnswerMap.set(qId, response);

          const randomScore =
            canAddScore && q.score ? randomIntBetween(0, q.score) : undefined;

          return {
            question: q._id,
            response,
            score: randomScore,
            scoringMethod:
              randomScore != null ? ScoringMethod.AUTO : ScoringMethod.NONE,
          } as ResponseSetType;
        })
        .filter((entry): entry is ResponseSetType => entry !== null);

      const scoredEntries = responseset.filter(
        (i) => typeof i.score === "number" && i.score > 0,
      );

      const baseScore = canAddScore
        ? Math.min(
            scoredEntries
              .filter((i) => !extraScoreQIds.has(i.question.toString()))
              .reduce((sum, res) => sum + (res.score ?? 0), 0),
            isForm.totalscore ?? 0,
          )
        : 0;

      const extraScore = canAddScore
        ? scoredEntries
            .filter((i) => extraScoreQIds.has(i.question.toString()))
            .reduce((sum, res) => sum + (res.score ?? 0), 0)
        : 0;

      return {
        formId: isForm._id,
        respondentEmail: r.respondentEmail,
        respondentName: r.respondentName,
        respondentType: r.respondentType,
        responseset,
        submittedAt: randomSubmittedDate(),
        completionTime: randomCompletionTime(),
        completionStatus: ResponseCompletionStatus.submitted,
        maxScore: canAddScore ? isForm.totalscore : undefined,
        totalScore: baseScore,
        extraScore: extraScore > 0 ? extraScore : undefined,
      };
    })
    .filter((doc) => doc.responseset!.length > 0);

  if (responseDocs.length === 0) {
    console.log("No responses generated");
    return false;
  }

  const inserted = await FormResponse.insertMany(responseDocs);
  console.log(`Generated ${inserted.length} responses for form ${formId} with options {
    ${JSON.stringify(params)}
    }`);
  return inserted;
};
