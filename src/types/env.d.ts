declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    DATABASE_URL: string;
    NODE_ENV?: "DEV" | "PROD" | "TEST";
    ADMIN_EMAIL: string;
    ADMIN_KEY: string;
    EMAIL_APP_PASSWORD: string;
    JWT_SECRET: string;
    REFRESH_TOKEN_COOKIE: string;
    [key: string]: string | undefined; // Optional: For additional dynamic environment variables
  }
}
