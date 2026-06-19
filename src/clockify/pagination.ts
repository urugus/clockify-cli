import { err, ok, type Result } from "neverthrow";
import { type AppError, appError } from "../errors/app-error.js";

export type PageInput = {
  readonly page?: number;
  readonly pageSize?: number;
};

export type PageResult<T> = {
  readonly items: readonly T[];
  readonly lastPage: boolean;
};

export const defaultPage = 1;
export const defaultPageSize = 50;
export const maxPageSize = 1000;

export const validatePageNumber = (value: number, field: string): Result<number, AppError> => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return err(appError("validation_error", `${field} must be a positive integer.`));
  }

  return ok(value);
};

export const validatePageSize = (value: number): Result<number, AppError> =>
  validatePageNumber(value, "Page size").andThen((pageSize) => {
    if (pageSize > maxPageSize) {
      return err(
        appError("validation_error", `Page size must be less than or equal to ${maxPageSize}.`),
      );
    }

    return ok(pageSize);
  });

export const normalizePageInput = (input: PageInput): Result<Required<PageInput>, AppError> =>
  validatePageNumber(input.page ?? defaultPage, "Page").andThen((page) =>
    validatePageSize(input.pageSize ?? defaultPageSize).map((pageSize) => ({ page, pageSize })),
  );

export const appendPageParams = (
  params: URLSearchParams,
  input: Required<PageInput>,
): URLSearchParams => {
  const nextParams = new URLSearchParams(params);
  nextParams.set("page", String(input.page));
  nextParams.set("pageSize", String(input.pageSize));
  return nextParams;
};

export const isLastPageHeader = (value: string | null): boolean => value?.toLowerCase() === "true";
