# EmailService ContentTitle Integration

## Overview

The EmailService has been updated to support `ContentTitle` objects (TipTap JSON format) in addition to plain strings for form titles and question titles. This allows rich text content to be properly converted to readable text in email templates.

## Updated Interfaces

### ResponseEmailData

```typescript
export interface ResponseEmailData {
  to: string;
  formTitle: string | ContentTitle;
  totalScore: number;
  maxScore: number;
  responseId: string;
  isAutoScored: boolean;
  questions?: Array<{
    title: string | ContentTitle;
    type: string;
    answer: any;
    userResponse: any;
    score: number;
    maxScore: number;
    isCorrect?: boolean;
  }>;
  respondentName?: string;
  submittedAt?: Date;
}
```

### FormLinkEmailData

```typescript
export interface FormLinkEmailData {
  formId: string;
  formTitle: string | ContentTitle;
  formOwner: string;
  recipientEmails: string[];
  message?: string;
}
```

## Key Changes Made

1. **Import ContentTitle Support**

   ```typescript
   import { contentTitleToString } from "../utilities/helper";
   import { ContentTitle } from "../model/Content.model";
   ```

2. **Added Helper Method**

   ```typescript
   private convertTitleToString(title: string | ContentTitle): string {
     if (typeof title === 'string') {
       return title;
     }
     return contentTitleToString(title);
   }
   ```

3. **Updated Email Templates**
   - Form titles now use `this.convertTitleToString(data.formTitle)`
   - Question titles use `this.convertTitleToString(question.title)`
   - All text is properly escaped with `this.escapeHtml()`

## Usage Examples

### Response Email with ContentTitle

```typescript
const responseData: ResponseEmailData = {
  to: "user@example.com",
  formTitle: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Employee Satisfaction Survey" }],
      },
    ],
  },
  totalScore: 85,
  maxScore: 100,
  responseId: "12345",
  isAutoScored: true,
  questions: [
    {
      title: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Rate your job satisfaction" }],
          },
        ],
      },
      type: "multiple",
      answer: "Very Satisfied",
      userResponse: "Very Satisfied",
      score: 10,
      maxScore: 10,
      isCorrect: true,
    },
  ],
};

const emailService = new EmailService();
await emailService.sendResponseResults(responseData);
```

### Form Link Email with ContentTitle

```typescript
const formLinkData: FormLinkEmailData = {
  formId: "form123",
  formTitle: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Annual Performance Review" }],
      },
    ],
  },
  formOwner: "HR Department",
  recipientEmails: ["employee@example.com"],
  message: "Please complete your annual review.",
};

await emailService.sendFormLinks(formLinkData);
```

## Benefits

1. **Rich Text Support**: Form and question titles can now include formatting from TipTap editor
2. **Backwards Compatibility**: Still supports plain string titles
3. **Proper Conversion**: ContentTitle objects are converted to readable text using `contentTitleToString`
4. **Safe HTML**: All content is properly escaped to prevent XSS attacks
5. **Consistent Formatting**: Maintains proper spacing and line breaks in email content

## Testing

- ✅ Updated interfaces support both string and ContentTitle
- ✅ Email templates properly convert ContentTitle to readable text
- ✅ HTML escaping works correctly
- ✅ Backwards compatibility maintained
- ✅ TypeScript compilation successful

## Files Modified

1. `src/services/EmailService.ts` - Main service with ContentTitle support
2. `src/services/EmailServiceUtils.ts` - Utility functions for ContentTitle handling
3. `src/services/__tests__/EmailService.contentTitle.test.ts` - Test examples

The EmailService now seamlessly works with both plain string titles and rich ContentTitle objects, ensuring that form and question titles are properly displayed in all email communications.
