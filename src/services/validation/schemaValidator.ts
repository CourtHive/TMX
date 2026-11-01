/**
 * On-demand CODES schema validation.
 *
 * ajv, ajv-formats and the tournament schema shipped with the INSTALLED factory
 * (`tods-competition-factory/schema/tournament.schema.json`) are reached only through
 * dynamic `import()`, so the bundler splits them into their own chunk. Nothing here is
 * loaded at startup: the first call to `validateAgainstSchema` fetches and compiles the
 * validator, later calls reuse it.
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

// ajv and ajv-formats are CommonJS; depending on the interop layer the class arrives as
// `module.default` or `module.default.default`.
function interopDefault(mod: any): any {
  const first = mod?.default ?? mod;
  return typeof first === 'function' ? first : (first?.default ?? first);
}

async function createValidator(): Promise<ValidateFunction> {
  const [ajvModule, formatsModule, schemaModule] = await Promise.all([
    import('ajv'),
    import('ajv-formats'),
    import('tods-competition-factory/schema/tournament.schema.json'),
  ]);
  const Ajv = interopDefault(ajvModule);
  const addFormats = interopDefault(formatsModule);
  const schema = (schemaModule as any).default ?? schemaModule;

  // The same options as the factory's own schema tests (src/tests/global/schemaValidation.test.ts),
  // so TMX reports what the factory considers invalid: Ajv's default draft-07 and default strict
  // mode, allowUnionTypes for the schema's ["string", "object"] date-time fields, and allErrors so
  // one bad field does not hide the rest.
  const ajv = new Ajv({ allowUnionTypes: true, allErrors: true });
  addFormats(ajv);
  return ajv.compile(schema);
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
