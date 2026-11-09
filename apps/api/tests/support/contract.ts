import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

const OPENAPI_PATH = fileURLToPath(
  new URL('../../../../specs/002-accounts-transactions/contracts/openapi.yaml', import.meta.url),
);

type Json = Record<string, unknown>;

const spec = parse(readFileSync(OPENAPI_PATH, 'utf-8')) as Json;

// OpenAPI 3.1 usa JSON Schema 2020-12. `strict: false` acepta las palabras propias de OpenAPI
// (`example`, `description` sueltas, etc.).
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(spec, 'openapi');

const pointer = (...parts: string[]) =>
  `openapi#/${parts.map((p) => p.replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`;

const REF_PREFIX = '#/components/responses/';

/** Ubica el objeto de respuesta (siguiendo `$ref`) y la ruta JSON de su esquema `application/json`. */
function findResponseSchema(method: string, path: string, status: number) {
  const operation = (spec.paths as Record<string, Record<string, Json>>)[path]?.[method];
  if (!operation) {
    throw new Error(`Contrato: no existe la operación ${method.toUpperCase()} ${path}`);
  }

  const responses = operation.responses as Record<string, Json>;
  const response = responses[String(status)];
  if (!response) {
    const documented = Object.keys(responses).join(', ');
    throw new Error(
      `Contrato: ${method.toUpperCase()} ${path} no documenta el estado ${status} (documentados: ${documented})`,
    );
  }

  let base = ['paths', path, method, 'responses', String(status)];
  let resolved = response;
  const ref = response.$ref as string | undefined;
  if (ref?.startsWith(REF_PREFIX)) {
    const name = ref.slice(REF_PREFIX.length);
    resolved = (spec.components as { responses: Record<string, Json> }).responses[name] as Json;
    base = ['components', 'responses', name];
  }

  const content = resolved.content as Record<string, Json> | undefined;
  const hasJson = content?.['application/json']?.schema !== undefined;
  return { hasJson, schemaPointer: pointer(...base, 'content', 'application/json', 'schema') };
}

/**
 * Verifica que una respuesta real cumple el contrato: que el estado esté documentado para esa
 * operación y que el cuerpo JSON cumpla el esquema. `path` es la ruta del contrato
 * (por ejemplo `/v1/auth/login`), no la URL concreta.
 */
export function expectMatchesContract(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  status: number,
  body: unknown,
): void {
  const { hasJson, schemaPointer } = findResponseSchema(method, path, status);

  if (!hasJson) {
    if (body !== undefined && body !== null && body !== '') {
      throw new Error(
        `Contrato: ${method.toUpperCase()} ${path} ${status} no debe llevar cuerpo JSON`,
      );
    }
    return;
  }

  const validate = ajv.getSchema(schemaPointer);
  if (!validate) throw new Error(`Contrato: no se pudo compilar el esquema ${schemaPointer}`);
  if (!validate(body)) {
    throw new Error(
      `La respuesta ${method.toUpperCase()} ${path} ${status} no cumple el contrato:\n${ajv.errorsText(validate.errors, { separator: '\n' })}\nCuerpo: ${JSON.stringify(body)}`,
    );
  }
}
