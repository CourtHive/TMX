/// <reference types="vite/client" />

// The CODES schema validator, compiled at build time by `precompiledSchemaValidator` (vite.shared.ts).
declare module 'virtual:tournament-schema-validator' {
  import type { ValidateFunction } from 'ajv';
  const validate: ValidateFunction;
  export default validate;
}
