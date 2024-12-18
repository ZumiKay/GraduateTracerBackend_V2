import nodemailer from "nodemailer";

const HandleEmail = async (
  to: string,
  subject: string,
  message: string,
  html: string
) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.ADMIN_EMAIL,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });

  try {
    const sendMail = await transporter.sendMail({
      from: process.env.ADMIN_EMAIL, // Ensure the 'from' field is set, usually set to the admin email
      to,
      subject,
      text: message,
      html,
    });

    console.log(
      `Email sent successfully to ${to}. Message ID: ${sendMail.messageId}`
    );
    return { success: true, message: "Email sent successfully" };
  } catch (error: any) {
    console.error("Error sending email:", error.message);
    return { success: false, message: `Error sending email: ${error.message}` };
  }
};

export default HandleEmail;
