import puppeteer from "puppeteer";

class PDFExportService {
  static async generateAnalyticsPDF(
    analyticsData: any,
    formTitle: string
  ): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(
        this.generateHTMLTemplate(analyticsData, formTitle)
      );

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "20px",
          right: "20px",
          bottom: "20px",
          left: "20px",
        },
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private static generateHTMLTemplate(data: any, formTitle: string): string {
    const currentDate = new Date().toLocaleDateString();

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Analytics Report - ${formTitle}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #3B82F6;
            }
            .header h1 {
              color: #3B82F6;
              margin: 0;
              font-size: 24px;
            }
            .header p {
              color: #666;
              margin: 5px 0;
            }
            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 20px;
              margin-bottom: 30px;
            }
            .metric-card {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
              border: 1px solid #e9ecef;
            }
            .metric-card h3 {
              margin: 0 0 10px 0;
              color: #666;
              font-size: 14px;
              font-weight: normal;
            }
            .metric-card .value {
              font-size: 32px;
              font-weight: bold;
              color: #3B82F6;
            }
            .section {
              margin-bottom: 30px;
            }
            .section h2 {
              color: #333;
              font-size: 20px;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 1px solid #e9ecef;
            }
            .question-analysis {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 15px;
              border: 1px solid #e9ecef;
            }
            .question-analysis h3 {
              color: #333;
              margin: 0 0 10px 0;
              font-size: 16px;
            }
            .question-stats {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
              gap: 10px;
              margin-top: 10px;
            }
            .stat-item {
              background: white;
              padding: 10px;
              border-radius: 4px;
              text-align: center;
              border: 1px solid #e9ecef;
            }
            .stat-item .label {
              font-size: 12px;
              color: #666;
            }
            .stat-item .value {
              font-size: 18px;
              font-weight: bold;
              color: #3B82F6;
            }
            .performer-list {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              border: 1px solid #e9ecef;
            }
            .performer-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 10px;
              background: white;
              border-radius: 4px;
              margin-bottom: 8px;
              border: 1px solid #e9ecef;
            }
            .performer-item:last-child {
              margin-bottom: 0;
            }
            .performer-info {
              flex: 1;
            }
            .performer-name {
              font-weight: bold;
              color: #333;
            }
            .performer-email {
              color: #666;
              font-size: 12px;
            }
            .performer-score {
              font-size: 18px;
              font-weight: bold;
              color: #10B981;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e9ecef;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Analytics Report</h1>
            <p><strong>${formTitle}</strong></p>
            <p>Generated on ${currentDate}</p>
          </div>

          <div class="metrics-grid">
            <div class="metric-card">
              <h3>Total Responses</h3>
              <div class="value">${data.totalResponses}</div>
            </div>
            <div class="metric-card">
              <h3>Completion Rate</h3>
              <div class="value">${(
                (data.completedResponses / data.totalResponses) *
                100
              ).toFixed(1)}%</div>
            </div>
            <div class="metric-card">
              <h3>Average Score</h3>
              <div class="value">${data.averageScore.toFixed(1)}</div>
            </div>
            <div class="metric-card">
              <h3>Response Rate</h3>
              <div class="value">${data.responseRate.toFixed(1)}%</div>
            </div>
          </div>

          <div class="section">
            <h2>Question Analysis</h2>
            ${data.questionAnalytics
              .map(
                (question: any, index: number) => `
              <div class="question-analysis">
                <h3>Question ${index + 1}: ${question.questionTitle}</h3>
                <div class="question-stats">
                  <div class="stat-item">
                    <div class="label">Responses</div>
                    <div class="value">${question.totalResponses}</div>
                  </div>
                  <div class="stat-item">
                    <div class="label">Accuracy</div>
                    <div class="value">${question.accuracy.toFixed(1)}%</div>
                  </div>
                  <div class="stat-item">
                    <div class="label">Avg Score</div>
                    <div class="value">${question.averageScore.toFixed(1)}</div>
                  </div>
                  <div class="stat-item">
                    <div class="label">Type</div>
                    <div class="value">${question.questionType}</div>
                  </div>
                </div>
              </div>
            `
              )
              .join("")}
          </div>

          <div class="section">
            <h2>Top Performers</h2>
            <div class="performer-list">
              ${data.performanceMetrics.topPerformers
                .map(
                  (performer: any, index: number) => `
                <div class="performer-item">
                  <div class="performer-info">
                    <div class="performer-name">#${index + 1} ${
                    performer.name
                  }</div>
                    <div class="performer-email">${performer.email}</div>
                  </div>
                  <div class="performer-score">${performer.score} pts</div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>

          <div class="section">
            <h2>Difficult Questions</h2>
            <div class="performer-list">
              ${data.performanceMetrics.difficultQuestions
                .map(
                  (question: any) => `
                <div class="performer-item">
                  <div class="performer-info">
                    <div class="performer-name">${question.title}</div>
                    <div class="performer-email">Accuracy: ${question.accuracy.toFixed(
                      1
                    )}%</div>
                  </div>
                  <div class="performer-score">${question.averageScore.toFixed(
                    1
                  )} avg</div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>

          <div class="section">
            <h2>Score Distribution</h2>
            <div class="performer-list">
              ${data.scoreDistribution
                .map(
                  (score: any) => `
                <div class="performer-item">
                  <div class="performer-info">
                    <div class="performer-name">${score.scoreRange}</div>
                    <div class="performer-email">${score.count} responses</div>
                  </div>
                  <div class="performer-score">${score.percentage.toFixed(
                    1
                  )}%</div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>

          <div class="footer">
            <p>Report generated by Graduate Tracer Analytics System</p>
          </div>
        </body>
      </html>
    `;
  }
}

export default PDFExportService;
