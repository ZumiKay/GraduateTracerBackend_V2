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
    ACCESS_TOKEN_COOKIE: string;
    RECAPCHA_SECRETKEY: string;
    LOGIN_ATTEMPT: string;
    RESPONDENT_COOKIE: string;
    ACCESS_RESPONDENT_COOKIE: string;
    RESPONDENT_TOKEN_JWT_SECRET: string;
    // Email service configuration
    SMTP_HOST: string;
    SMTP_PORT: string;
    SMTP_USER: string;
    SMTP_PASSWORD: string;
    SMTP_FROM: string;
    // Frontend URL for form links
    FRONTEND_URL: string;
    // Form link expiration
    FORM_LINK_EXPIRATION: string;
    [key: string]: string | undefined; // Optional: For additional dynamic environment variables
  }
}
