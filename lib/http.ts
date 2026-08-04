import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "The request is invalid.",
          fields: error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }
  console.error("Unhandled API error", {
    name: error instanceof Error ? error.name : "Unknown",
    message: error instanceof Error ? error.message : "Unknown error",
  });
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 },
  );
}

export function noStoreJson(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "private, no-store");
  return Response.json(data, { ...init, headers });
}
