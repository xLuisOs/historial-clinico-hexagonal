-- =====================================================================
-- Centro Médico Pediátrico — agrega RECEPCIONISTA a una base que ya existe:
--   npm run db:mysql -- --solo 07_recepcionistas.sql
--
-- Solo hace falta si la base se creó antes de que 01_esquema.sql trajera la
-- tabla recepcionista. No borra nada y se puede correr más de una vez; en una
-- base nueva no hace nada.
--
-- Las cuentas de recepción que ya existen siguen funcionando: a cada una se le
-- crea su recepcionista a partir de nombre_mostrar ("Recepción" queda como
-- "Recepción General"). Después el admin corrige los nombres desde el sistema.
-- =====================================================================
USE pediatrico;

CREATE TABLE IF NOT EXISTS recepcionista (
  id_recepcionista  INT AUTO_INCREMENT PRIMARY KEY,
  nombres           VARCHAR(100) NOT NULL,
  apellidos         VARCHAR(100) NOT NULL,
  telefono          VARCHAR(20)  NULL,                 -- confidencial
  activo            BOOLEAN      NOT NULL DEFAULT TRUE,
  fecha_registro    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- MySQL 8 no tiene ADD COLUMN IF NOT EXISTS: se revisa el catálogo antes de
-- cada cambio, dentro de un procedimiento temporal.
DROP PROCEDURE IF EXISTS migrar_recepcionistas;

DELIMITER $$

CREATE PROCEDURE migrar_recepcionistas()
BEGIN
  DECLARE fin BOOLEAN DEFAULT FALSE;
  DECLARE v_id INT;
  DECLARE v_nombre VARCHAR(120);
  DECLARE v_activo BOOLEAN;
  DECLARE cuentas CURSOR FOR
    SELECT id_usuario, TRIM(nombre_mostrar), activo FROM usuario
    WHERE rol = 'recepcion' AND recepcionista_fk IS NULL;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET fin = TRUE;

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = 'pediatrico' AND TABLE_NAME = 'usuario' AND COLUMN_NAME = 'recepcionista_fk') THEN
    ALTER TABLE usuario ADD COLUMN recepcionista_fk INT NULL AFTER medico_fk;
  END IF;

  -- Una recepcionista por cada cuenta de recepción que todavía no la tenga.
  OPEN cuentas;
  repetir: LOOP
    FETCH cuentas INTO v_id, v_nombre, v_activo;
    IF fin THEN LEAVE repetir; END IF;
    INSERT INTO recepcionista (nombres, apellidos, activo) VALUES (
      IF(LOCATE(' ', v_nombre) > 0, SUBSTRING_INDEX(v_nombre, ' ', 1), v_nombre),
      IF(LOCATE(' ', v_nombre) > 0, SUBSTRING(v_nombre, LOCATE(' ', v_nombre) + 1), 'General'),
      v_activo);
    UPDATE usuario SET recepcionista_fk = LAST_INSERT_ID() WHERE id_usuario = v_id;
  END LOOP;
  CLOSE cuentas;

  -- Las reglas van después de llenar recepcionista_fk.
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
                 WHERE TABLE_SCHEMA = 'pediatrico' AND TABLE_NAME = 'usuario' AND CONSTRAINT_NAME = 'uq_usuario_recepcionista') THEN
    ALTER TABLE usuario ADD CONSTRAINT uq_usuario_recepcionista UNIQUE (recepcionista_fk);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
                 WHERE TABLE_SCHEMA = 'pediatrico' AND TABLE_NAME = 'usuario' AND CONSTRAINT_NAME = 'fk_usuario_recepcionista') THEN
    ALTER TABLE usuario ADD CONSTRAINT fk_usuario_recepcionista FOREIGN KEY (recepcionista_fk)
      REFERENCES recepcionista (id_recepcionista) ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
                 WHERE TABLE_SCHEMA = 'pediatrico' AND TABLE_NAME = 'usuario' AND CONSTRAINT_NAME = 'chk_usuario_recepcionista') THEN
    -- Toda cuenta de recepción es de una recepcionista, y solo esas cuentas lo son.
    ALTER TABLE usuario ADD CONSTRAINT chk_usuario_recepcionista
      CHECK ((rol = 'recepcion') = (recepcionista_fk IS NOT NULL));
  END IF;
END$$

DELIMITER ;

CALL migrar_recepcionistas();
DROP PROCEDURE migrar_recepcionistas;

-- pedi_app ya puede leer, insertar y actualizar la tabla por el
-- GRANT ... ON pediatrico.* de 03_seguridad.sql (y sigue sin poder borrar).
