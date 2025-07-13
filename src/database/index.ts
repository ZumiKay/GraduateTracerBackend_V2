import mongoose from "mongoose";
import FormResponse from "../model/Response.model";
import Form from "../model/Form.model";

export default async function DBConnection() {
  try {
    const URI = process.env.DATABASE_URL;
    if (!URI) {
      console.log("Connection String Not Found");
    }
    await mongoose.connect(process.env.DATABASE_URL as string, {});
    console.log("Connected To DB");
  } catch (error) {
    console.log("MongoDB Connection Error: ", error);
    process.exit(1);
  }
}
