-- =====================================================================
-- Centro Médico Pediátrico — referencia de pago según el método, en una base
-- que ya existe:   npm run db:mysql -- --solo 06_referencia_pago.sql
--
-- Reemplaza el trigger trg_pago_validar por la versión de 02_triggers.sql que
-- también revisa la referencia. Solo afecta a los pagos nuevos; se puede
-- correr más de una vez.
-- =====================================================================
USE pediatrico;

DROP TRIGGER IF EXISTS trg_pago_validar;

DELIMITER $$

-- Un pago no puede exceder el saldo ni aplicarse a un cobro cerrado, y su
-- referencia depende del método (la misma regla que dominio/pago.js): el
-- efectivo no lleva; la tarjeta, 6 letras o números del voucher (al menos un
-- número); la transferencia, de 6 a 20 dígitos. Un CHECK no alcanza porque el
-- método está en otra tabla (metodo_pago).
CREATE TRIGGER trg_pago_validar
BEFORE INSERT ON pago
FOR EACH ROW
BEGIN
  DECLARE v_estado VARCHAR(10);
  DECLARE v_saldo DECIMAL(10,2);
  DECLARE v_metodo VARCHAR(20);

  SELECT estado_cobro, monto_total - monto_pagado INTO v_estado, v_saldo
  FROM v_cobro_resumen WHERE id_cobro = NEW.cobro_fk;

  IF v_estado <> 'pendiente' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cobro no está pendiente';
  END IF;
  IF NEW.monto > v_saldo THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El pago excede el saldo del cobro';
  END IF;

  SELECT nombre INTO v_metodo FROM metodo_pago WHERE id_metodo_pago = NEW.metodo_pago_fk;
  IF v_metodo = 'efectivo' AND NEW.referencia IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El pago en efectivo no lleva referencia';
  END IF;
  IF v_metodo = 'tarjeta' AND NOT (NEW.referencia IS NOT NULL
       AND REGEXP_LIKE(NEW.referencia, '^[A-Z0-9]{6}$', 'c') AND REGEXP_LIKE(NEW.referencia, '[0-9]')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La autorización del voucher tiene 6 letras o números (al menos un número)';
  END IF;
  IF v_metodo = 'transferencia' AND NOT (NEW.referencia IS NOT NULL
       AND REGEXP_LIKE(NEW.referencia, '^[0-9]{6,20}$', 'c')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El número de boleta o transacción lleva de 6 a 20 dígitos';
  END IF;
END$$

DELIMITER ;

-- El pago con tarjeta de los datos de prueba tenía una autorización de 4
-- dígitos; se ajusta al formato nuevo para que la base quede igual que una
-- creada desde cero.
UPDATE pago SET referencia = '482155' WHERE referencia = '4821';
