import { AppSpecSchema, type AppSpec } from "./schemas";

export interface ParseResult {
  success: boolean;
  data?: AppSpec;
  errors?: Array<{ path: string; message: string }>;
}

export function parseDSL(json: unknown): ParseResult {
  try {
    const result = AppSpecSchema.safeParse(json);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    const errors = result.error.errors.map((err) => ({
      path: err.path.join("."),
      message: err.message,
    }));

    return {
      success: false,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          path: "root",
          message: error instanceof Error ? error.message : "Unknown parsing error",
        },
      ],
    };
  }
}

export function validateDSL(spec: AppSpec): ParseResult {
  return parseDSL(spec);
}

export function serializeDSL(spec: AppSpec): string {
  return JSON.stringify(spec, null, 2);
}

export function deserializeDSL(json: string): ParseResult {
  try {
    const parsed = JSON.parse(json);
    return parseDSL(parsed);
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          path: "root",
          message: error instanceof Error ? error.message : "Invalid JSON",
        },
      ],
    };
  }
}

