import Ajv, { type ValidateFunction } from "ajv";

const ajv = new Ajv({ allErrors: true, strict: true, validateFormats: false });

export function compileJsonSchema(schema: Record<string, unknown>, label: string): ValidateFunction {
  try {
    return ajv.compile(schema);
  } catch (error) {
    throw new Error(`${label} schema is invalid: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

export function assertMatchesSchema(validate: ValidateFunction, value: unknown, label: string) {
  if (!validate(value)) {
    const details = validate.errors?.map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ");
    throw new Error(`${label} does not match schema${details ? `: ${details}` : ""}`);
  }
}
