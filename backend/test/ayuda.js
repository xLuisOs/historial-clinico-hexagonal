// Ayudas para las pruebas: verificar que una regla rechaza los datos y en qué
// campo. Las pruebas no tocan ninguna base de datos: prueban el dominio y los
// casos de uso con repositorios falsos en memoria.
import assert from 'node:assert/strict';

/**
 * Exige que `fn` lance un error del tipo indicado; si se pasan campos, que
 * `detalles` traiga un mensaje para cada uno. Devuelve el error.
 */
export function rechaza(fn, Tipo, campos = []) {
  let error;
  try {
    fn();
  } catch (e) {
    error = e;
  }
  assert.ok(error, 'se esperaba que la regla rechazara los datos');
  assert.ok(error instanceof Tipo, `se esperaba ${Tipo.name} y llegó ${error?.constructor?.name}: ${error?.message}`);
  for (const campo of campos) {
    assert.ok(error.detalles?.[campo], `se esperaba un error en "${campo}"; llegaron: ${JSON.stringify(error.detalles)}`);
  }
  return error;
}

/** Igual que `rechaza`, para funciones asíncronas. */
export async function rechazaAsync(fn, Tipo, campos = []) {
  let error;
  try {
    await fn();
  } catch (e) {
    error = e;
  }
  assert.ok(error, 'se esperaba que la operación fuera rechazada');
  assert.ok(error instanceof Tipo, `se esperaba ${Tipo.name} y llegó ${error?.constructor?.name}: ${error?.message}`);
  for (const campo of campos) {
    assert.ok(error.detalles?.[campo], `se esperaba un error en "${campo}"; llegaron: ${JSON.stringify(error.detalles)}`);
  }
  return error;
}
