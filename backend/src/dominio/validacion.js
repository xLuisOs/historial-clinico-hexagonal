import { DatosInvalidos } from './errores.js';

// Acumula errores campo por campo para devolverlos todos juntos al cliente.
export class Validador {
  constructor() {
    this.errores = {};
  }

  error(campo, mensaje) {
    this.errores[campo] ??= mensaje;
  }

  texto(campo, valor, { requerido = false, max = 255 } = {}) {
    const limpio = typeof valor === 'string' ? valor.trim() : valor;
    if (limpio === undefined || limpio === null || limpio === '') {
      if (requerido) this.error(campo, 'Es obligatorio');
      return null;
    }
    if (typeof limpio !== 'string') return this.error(campo, 'Debe ser texto'), null;
    if (limpio.length > max) this.error(campo, `Máximo ${max} caracteres`);
    return limpio;
  }

  fecha(campo, valor, { requerido = false, noFutura = false } = {}) {
    if (!valor) {
      if (requerido) this.error(campo, 'Es obligatoria');
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(Date.parse(valor))) {
      this.error(campo, 'Formato esperado AAAA-MM-DD');
      return null;
    }
    if (noFutura && valor > new Date().toISOString().slice(0, 10)) {
      this.error(campo, 'No puede ser una fecha futura');
    }
    return valor;
  }

  numero(campo, valor, { requerido = false, min, max, entero = false } = {}) {
    if (valor === undefined || valor === null || valor === '') {
      if (requerido) this.error(campo, 'Es obligatorio');
      return null;
    }
    const n = Number(valor);
    if (!Number.isFinite(n) || (entero && !Number.isInteger(n))) {
      this.error(campo, entero ? 'Debe ser un número entero' : 'Debe ser un número');
      return null;
    }
    if (min !== undefined && n < min) this.error(campo, `Mínimo ${min}`);
    if (max !== undefined && n > max) this.error(campo, `Máximo ${max}`);
    return n;
  }

  opcion(campo, valor, opciones, { requerido = false } = {}) {
    if (valor === undefined || valor === null || valor === '') {
      if (requerido) this.error(campo, 'Es obligatorio');
      return null;
    }
    if (!opciones.includes(valor)) this.error(campo, `Valores permitidos: ${opciones.join(', ')}`);
    return valor;
  }

  patron(campo, valor, regex, mensaje, opciones) {
    const limpio = this.texto(campo, valor, opciones);
    if (limpio && !regex.test(limpio)) this.error(campo, mensaje);
    return limpio;
  }

  lanzarSiHayErrores(mensaje = 'Datos inválidos') {
    if (Object.keys(this.errores).length > 0) throw new DatosInvalidos(mensaje, this.errores);
  }
}
