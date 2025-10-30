import { z } from "zod";

export function createEnvSchema<T extends Record<string, z.ZodTypeAny>>(
  schema: T
): z.ZodObject<T> {
  return z.object(schema);
}

export function validateEnv<T extends Record<string, z.ZodTypeAny>>(
  schema: z.ZodObject<T>,
  env: Record<string, string | undefined>
): z.infer<z.ZodObject<T>> {
  return schema.parse(env);
}

export function createEnvValidator<T extends Record<string, z.ZodTypeAny>>(
  schema: T
) {
  const zodSchema = createEnvSchema(schema);
  return {
    validate: (env: Record<string, string | undefined>) => validateEnv(zodSchema, env),
    schema: zodSchema,
  };
}

