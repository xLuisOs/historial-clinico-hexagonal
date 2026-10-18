import { NoDisponible } from '../../dominio/errores.js';
import { PUERTOS } from '../../puertos/repositorios.js';

/**
 * Adaptador de relleno para un motor que aún no está programado: cumple el
 * contrato, pero cada método responde "no disponible". Permite que la app
 * arranque y que cada quien avance su motor por separado.
 */
export function adaptadorPendiente(descripcion) {
  return Object.fromEntries(
    Object.entries(PUERTOS).map(([repo, metodos]) => [
      repo,
      Object.fromEntries(
        Object.keys(metodos).map((metodo) => [
          metodo,
          async () => {
            throw new NoDisponible(`${descripcion}: ${repo}.${metodo} aún no está implementado`);
          },
        ]),
      ),
    ]),
  );
}
