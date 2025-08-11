/**
 * Script to recalculate total scores for all forms, excluding Text questions
 * Run this once to fix any existing forms that have incorrect total scores due to Text questions
 */

const mongoose = require("mongoose");

// Define schemas
const formSchema = new mongoose.Schema({
  title: String,
  totalscore: { type: Number, default: 0 },
  // ... other fields
});

const contentSchema = new mongoose.Schema({
  formId: { type: mongoose.Schema.Types.ObjectId, ref: "Form" },
  type: String,
  score: { type: Number, default: 0 },
  // ... other fields
});

const Form = mongoose.model("Form", formSchema);
const Content = mongoose.model("Content", contentSchema);

async function fixTotalScores() {
  try {
    console.log("Starting total score recalculation...");

    // Get all forms
    const forms = await Form.find({});
    console.log(`Found ${forms.length} forms to process`);

    let updatedCount = 0;

    for (const form of forms) {
      // Get all contents for this form
      const contents = await Content.find({ formId: form._id });

      // Calculate correct total score (excluding Text questions)
      const correctTotal = contents
        .filter((content) => content.type !== "Text")
        .reduce((sum, content) => sum + (content.score || 0), 0);

      // Update if different
      if (form.totalscore !== correctTotal) {
        await Form.findByIdAndUpdate(form._id, { totalscore: correctTotal });
        console.log(
          `Updated form "${form.title}": ${form.totalscore} → ${correctTotal}`
        );
        updatedCount++;
      }
    }

    console.log(
      `✅ Completed! Updated ${updatedCount} forms out of ${forms.length} total forms`
    );
  } catch (error) {
    console.error("❌ Error fixing total scores:", error);
  }
}

// Run the script
async function main() {
  // Connect to MongoDB (adjust connection string as needed)
  const mongoUri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/graduatetracer";

  try {
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    await fixTotalScores();
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error);
  } finally {
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { fixTotalScores };
