// Keep tests independent of secrets in the local .env file.
// An empty value counts as "set" for dotenv, so .env can't fill it in later,
// and the Turnstile check is skipped (its own tests set a test secret).
process.env.TURNSTILE_SECRET = "";
