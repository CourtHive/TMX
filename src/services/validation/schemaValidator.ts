/**
 * On-demand CODES schema validation.
 *
 * The validator is compiled at build time from the tournament schema shipped with the INSTALLED factory
 * (`tods-competition-factory/schema/tournament.schema.json`): see `precompiledSchemaValidator` in vite.shared.ts.
 * Compiling in the browser would evaluate generated source, which the CSP forbids. The module is reached only
 * through dynamic `import()`, so the bundler splits it into its own chunk. Nothing here is loaded at startup: the
 * first call to `validateAgainstSchema` fetches the validator, later calls reuse it.
 */
import type { ValidateFunction } from 'ajv';

export type SchemaError = {
  instancePath: string;
  message: string;
  keyword?: string;
  params?: Record<string, any>;
};

export type SchemaValidationResult = {
  schemaErrors: SchemaError[];
  // true when the validator chunk could not be loaded (e.g. offline before it was cached)
  unavailable?: boolean;
};

let validatorPromise: Promise<ValidateFunction> | undefined;

async function createValidator(): Promise<ValidateFunction> {
  const { default: validate } = await import('virtual:tournament-schema-validator');
  return validate;
}

export function loadSchemaValidator(): Promise<ValidateFunction> {
  validatorPromise ??= createValidator().catch((error) => {
    // forget the failure so a later call can retry once the chunk is reachable
    validatorPromise = undefined;
    throw error;
  });
  return validatorPromise;
}

export async function validateAgainstSchema(tournamentRecord: any): Promise<SchemaValidationResult> {
  let validate: ValidateFunction;
  try {
    validate = await loadSchemaValidator();
  } catch (error) {
    console.warn('[schemaValidator] validator could not be loaded', error);
    return { schemaErrors: [], unavailable: true };
  }

  if (validate(tournamentRecord)) return { schemaErrors: [] };

  const schemaErrors = (validate.errors ?? []).map((error) => ({
    instancePath: error.instancePath || '/',
    message: error.message ?? error.keyword,
    keyword: error.keyword,
    params: error.params,
  }));
  return { schemaErrors };
}
