export type AppErrorCode =
  | "clockify_http_error"
  | "clockify_invalid_response"
  | "clockify_rate_limited"
  | "config_invalid"
  | "config_write_failed"
  | "keychain_failed"
  | "profile_not_found"
  | "validation_error";

export type AppError = {
  readonly code: AppErrorCode;
  readonly message: string;
  readonly cause?: unknown;
};

export const appError = (code: AppErrorCode, message: string, cause?: unknown): AppError => ({
  code,
  message,
  cause,
});
