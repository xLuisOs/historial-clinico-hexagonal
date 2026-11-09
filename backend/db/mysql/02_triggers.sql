-- =====================================================================
-- Centro Médico Pediátrico — reglas de integridad que un CHECK no puede
-- expresar porque involucran otras tablas. La aplicación también las valida,
-- pero la base es la última línea de defensa.
-- =====================================================================
USE pediatrico;

DELIMITER $$

-- No se agendan ni registran atenciones para un historial archivado.
CREATE TRIGGER trg_cita_paciente_activo
BEFORE INSERT ON cita
FOR EACH ROW
BEGIN
  IF (SELECT activo FROM paciente WHERE id_paciente = NEW.paciente_fk) = FALSE THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial del paciente está archivado';
  END IF;
END$$

-- Tampoco se agregan antecedentes a un historial archivado.
CREATE TRIGGER trg_antecedente_paciente_activo
BEFORE INSERT ON antecedente
FOR EACH ROW
BEGIN
  IF (SELECT activo FROM paciente WHERE id_paciente = NEW.paciente_fk) = FALSE THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial del paciente está archivado';
  END IF;
END$$

-- Si la vacuna se aplicó durante una consulta, la consulta debe ser del mismo paciente.
CREATE TRIGGER trg_vacuna_aplicada_consistente
BEFORE INSERT ON vacuna_aplicada
FOR EACH ROW
BEGIN
  IF (SELECT activo FROM paciente WHERE id_paciente = NEW.paciente_fk) = FALSE THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial del paciente está archivado';
  END IF;
  IF NEW.consulta_fk IS NOT NULL AND NEW.paciente_fk <> (
       SELECT ci.paciente_fk FROM consulta co JOIN cita ci ON ci.id_cita = co.cita_fk
       WHERE co.id_consulta = NEW.consulta_fk) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La consulta no pertenece al paciente';
  END IF;
END$$

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

-- Al completar el monto, el cobro pasa a 'pagado' automáticamente.
CREATE TRIGGER trg_pago_cerrar_cobro
AFTER INSERT ON pago
FOR EACH ROW
BEGIN
  UPDATE cobro c
  JOIN v_cobro_resumen r ON r.id_cobro = c.id_cobro
  SET c.estado_cobro = 'pagado'
  WHERE c.id_cobro = NEW.cobro_fk AND r.monto_pagado >= r.monto_total;
END$$

DELIMITER ;
