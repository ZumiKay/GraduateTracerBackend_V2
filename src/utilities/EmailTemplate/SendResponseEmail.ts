import { FormType } from "../../model/Form.model";
import { FormResponseType } from "../../model/Response.model";
import { getResponseDisplayName } from "../respondentUtils";

export const generateResponseHTML = (
  form: FormType,
  response: Partial<FormResponseType>
): string => {
  const respondentName = getResponseDisplayName(response);
  const submittedAt = response.submittedAt
    ? new Date(response.submittedAt).toLocaleDateString()
    : "N/A";

  let questionsHTML = "";

  if (response.responseset && Array.isArray(response.responseset)) {
    response.responseset.forEach((responseItem: any, index: number) => {
      const question = responseItem.questionId;
      if (!question) return;

      const questionTitle = question.title?.text || `Question ${index + 1}`;
      const questionType = question.type;
      let answerHTML = "";

      switch (questionType) {
        case "text":
        case "email":
        case "number":
          answerHTML = responseItem.answer || "No answer provided";
          break;
        case "multiple":
        case "selection":
          if (Array.isArray(responseItem.answer)) {
            answerHTML = responseItem.answer.join(", ");
          } else {
            answerHTML = responseItem.answer || "No selection made";
          }
          break;
        case "checkbox":
          if (Array.isArray(responseItem.answer)) {
            answerHTML = responseItem.answer.join(", ");
          } else {
            answerHTML = "No options selected";
          }
          break;
        case "rangedate":
          if (
            responseItem.answer &&
            Array.isArray(responseItem.answer) &&
            responseItem.answer.length === 2
          ) {
            const startDate = new Date(
              responseItem.answer[0]
            ).toLocaleDateString();
            const endDate = new Date(
              responseItem.answer[1]
            ).toLocaleDateString();
            answerHTML = `${startDate} - ${endDate}`;
          } else {
            answerHTML = "No date range provided";
          }
          break;
        case "rangenumber":
          if (
            responseItem.answer &&
            Array.isArray(responseItem.answer) &&
            responseItem.answer.length === 2
          ) {
            answerHTML = `${responseItem.answer[0]} - ${responseItem.answer[1]}`;
          } else {
            answerHTML = "No number range provided";
          }
          break;
        default:
          answerHTML =
            JSON.stringify(responseItem.answer) || "No answer provided";
      }

      const score =
        responseItem.score !== undefined ? responseItem.score : "Not scored";

      questionsHTML += `
          <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h3 style="color: #333; margin-bottom: 10px; font-size: 16px;">${questionTitle}</h3>
            <p style="margin-bottom: 8px;"><strong>Type:</strong> ${questionType}</p>
            <p style="margin-bottom: 8px;"><strong>Answer:</strong> ${answerHTML}</p>
            <p style="margin-bottom: 0;"><strong>Score:</strong> ${score}</p>
          </div>
        `;
    });
  }

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Response Export - ${form.title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .form-title {
            color: #007bff;
            font-size: 24px;
            margin-bottom: 10px;
          }
          .response-info {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .response-info p {
            margin: 5px 0;
          }
          .questions-section {
            margin-top: 20px;
          }
          .section-title {
            color: #007bff;
            font-size: 20px;
            margin-bottom: 20px;
            border-bottom: 1px solid #007bff;
            padding-bottom: 5px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="form-title">${form.title}</h1>
          <p>Response Export</p>
        </div>
        
        <div class="response-info">
          <h2>Response Information</h2>
          <p><strong>Respondent:</strong> ${respondentName}</p>
          <p><strong>Email:</strong> ${response.respondentEmail || "N/A"}</p>
          <p><strong>Total Score:</strong> ${response.totalScore || 0}/${
    form.totalscore || "N/A"
  }</p>
          <p><strong>Completion Status:</strong> ${
            response.completionStatus || "partial"
          }</p>
          <p><strong>Submitted:</strong> ${submittedAt}</p>
          <p><strong>Response ID:</strong> ${response._id}</p>
        </div>

        <div class="questions-section">
          <h2 class="section-title">Responses</h2>
          ${questionsHTML || "<p>No responses found.</p>"}
        </div>
        
        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #666;">
          <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </div>
      </body>
      </html>
    `;
};
