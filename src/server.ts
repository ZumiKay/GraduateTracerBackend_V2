import app from "./app";

const PORT = process.env.PORT ?? 4000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  if (process.env.USE_NGROK === "true") {
    console.log(
      `[ngrok] Ngrok mode active: trust proxy enabled, cross-site cookies (SameSite=None, Secure=true) enabled.`,
    );
  }
});
