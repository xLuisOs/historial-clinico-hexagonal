// Errores del dominio. No saben nada de HTTP ni de bases de datos:
// el adaptador HTTP los traduce a códigos de estado.

export class ErrorDominio extends Error {
  constructor(mensaje, detalles) {
    super(mensaje);
    this.name = this.constructor.name;
    this.detalles = detalles;
  }
}

/** Datos de entrada inválidos. */
export class DatosInvalidos extends ErrorDominio {}

/** El recurso no existe (o no pertenece a la institución del usuario). */
export class NoEncontrado extends ErrorDominio {}

/** La operación choca con el estado actual (duplicado, historial archivado...). */
export class Conflicto extends ErrorDominio {}

/** Credenciales incorrectas o sesión inválida. */
export class NoAutenticado extends ErrorDominio {}

/** El rol del usuario no permite la operación. */
export class SinPermiso extends ErrorDominio {}

/** La institución existe pero su motor aún no está implementado o configurado. */
export class NoDisponible extends ErrorDominio {}
