/** Cuerpo de error del contrato (contracts/openapi.yaml → Error). */
export interface ErrorJson {
  code: string;
  message: string;
  fields: Record<string, string>;
}

/** `Response.json()` devuelve `unknown`; las pruebas indican la forma que esperan. */
export async function jsonBody<T = ErrorJson>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
