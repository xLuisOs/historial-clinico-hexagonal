import {
  cuenta, diaSiguiente, tablaCitasPorProfesional, tablaIngresosPorMetodo, tasaInasistencia,
} from '../../../../dominio/reportes.js';
import { fechaATimestamp } from '../conexion.js';
import { COLECCIONES, nombreCompleto } from './modelo.js';

// Reportes de la clínica (ver dominio/reportes.js). Firestore no agrupa ni
// suma: se consultan los documentos del periodo (filtro de rango sobre un solo
// campo, que no necesita índice compuesto) y se cuentan aquí. Los pagos van
// dentro de cada consulta, así que los ingresos se calculan recorriendo las
// consultas y tomando los pagos cuya fecha cae en el periodo.

const redondear = (x) => Math.round(x * 100) / 100;

export function crearRepositorioReportes(db, zonaHoraria) {
  const col = (nombre) => db.collection(COLECCIONES[nombre]);

  return {
    async generar({ desde, hasta }) {
      const inicio = fechaATimestamp(desde, zonaHoraria);
      const fin = fechaATimestamp(diaSiguiente(hasta), zonaHoraria);
      const enPeriodo = (ts) => ts?.toMillis && ts.toMillis() >= inicio.toMillis() && ts.toMillis() < fin.toMillis();

      const [citasSnap, consultasSnap] = await Promise.all([
        col('citas').where('fecha_hora', '>=', inicio).where('fecha_hora', '<', fin).get(),
        col('consultas').get(), // se necesitan todas para los pagos del periodo y el saldo de hoy
      ]);

      // Citas: por estado y por odontólogo.
      const citas = {};
      const porOdontologo = new Map();
      for (const c of citasSnap.docs) {
        const estado = c.get('estado');
        citas[estado] = (citas[estado] ?? 0) + 1;
        const nombre = nombreCompleto(c.get('odontologo')) ?? 'Sin asignar';
        const fila = porOdontologo.get(nombre) ?? { profesional: nombre, total: 0, atendidas: 0, noAsistio: 0, canceladas: 0 };
        fila.total += 1;
        if (estado === 'atendida') fila.atendidas += 1;
        if (estado === 'no_asistio') fila.noAsistio += 1;
        if (estado === 'cancelada') fila.canceladas += 1;
        porOdontologo.set(nombre, fila);
      }

      // Consultas del periodo, procedimientos realizados, pagos del periodo y saldo de hoy.
      let consultasPeriodo = 0;
      let saldo = 0;
      let conSaldo = 0;
      const procedimientos = new Map();
      const metodos = new Map();
      for (const c of consultasSnap.docs) {
        const pagos = c.get('pagos') ?? [];
        const pendiente = redondear(Number(c.get('total') ?? 0) - pagos.reduce((s, p) => s + Number(p.monto ?? 0), 0));
        if (pendiente > 0) { saldo += pendiente; conSaldo += 1; }
        for (const p of pagos) {
          if (!enPeriodo(p.fecha)) continue;
          const m = metodos.get(p.metodo_pago) ?? { metodo: p.metodo_pago, pagos: 0, monto: 0 };
          m.pagos += 1;
          m.monto = redondear(m.monto + Number(p.monto ?? 0));
          metodos.set(p.metodo_pago, m);
        }
        if (!enPeriodo(c.get('fecha_atencion'))) continue;
        consultasPeriodo += 1;
        for (const p of c.get('procedimientos') ?? []) {
          const fila = procedimientos.get(p.nombre) ?? { procedimiento: p.nombre, cantidad: 0, monto: 0 };
          fila.cantidad += 1;
          fila.monto = redondear(fila.monto + Number(p.precio_aplicado ?? 0));
          procedimientos.set(p.nombre, fila);
        }
      }

      const ingresos = [...metodos.values()].sort((a, b) => b.monto - a.monto);
      const totalCitas = Object.values(citas).reduce((s, x) => s + x, 0);

      return {
        desde,
        hasta,
        indicadores: [
          { titulo: 'Consultas', valor: consultasPeriodo, formato: 'numero' },
          { titulo: 'Citas', valor: totalCitas, formato: 'numero', nota: cuenta(citas.atendida ?? 0, 'atendida') },
          { titulo: 'Inasistencia', valor: tasaInasistencia(citas), formato: 'porcentaje', nota: cuenta(citas.no_asistio ?? 0, 'paciente no llegó', 'pacientes no llegaron') },
          { titulo: 'Ingresos', valor: redondear(ingresos.reduce((s, f) => s + f.monto, 0)), formato: 'dinero', nota: cuenta(ingresos.reduce((s, f) => s + f.pagos, 0), 'pago') },
          { titulo: 'Saldo por cobrar (hoy)', valor: redondear(saldo), formato: 'dinero', nota: cuenta(conSaldo, 'consulta con saldo', 'consultas con saldo') },
        ],
        tablas: [
          tablaCitasPorProfesional('Citas por odontólogo', [...porOdontologo.values()].sort((a, b) => b.total - a.total)),
          {
            titulo: 'Procedimientos realizados',
            columnas: [
              { clave: 'procedimiento', titulo: 'Procedimiento' },
              { clave: 'cantidad', titulo: 'Cantidad', formato: 'numero' },
              { clave: 'monto', titulo: 'Monto', formato: 'dinero' },
            ],
            filas: [...procedimientos.values()].sort((a, b) => b.cantidad - a.cantidad || b.monto - a.monto),
          },
          tablaIngresosPorMetodo(ingresos),
        ],
      };
    },
  };
}
