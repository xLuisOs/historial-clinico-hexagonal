-- =====================================================================
-- Centro Médico Pediátrico — agrega el catálogo ESPECIALIDAD a una base que
-- ya existe:   npm run db:mysql -- --solo 08_especialidades.sql
--
-- Crea la tabla, la llena con las especialidades que ya usan los médicos y
-- liga medico.especialidad al catálogo por nombre (ON UPDATE CASCADE). No
-- borra nada y se puede correr más de una vez; en una base nueva no hace nada.
-- =====================================================================
USE pediatrico;

CREATE TABLE IF NOT EXISTS especialidad (
  id_especialidad  INT AUTO_INCREMENT PRIMARY KEY,
  nombre           VARCHAR(80) NOT NULL,
  CONSTRAINT uq_especialidad_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

-- Las que ya están en uso (la collation ignora mayúsculas y tildes, así que
-- "Cardiologia" y "Cardiología" quedan como una sola).
INSERT IGNORE INTO especialidad (nombre)
SELECT DISTINCT especialidad FROM medico;

DROP PROCEDURE IF EXISTS migrar_especialidades;

DELIMITER $$

CREATE PROCEDURE migrar_especialidades()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
                 WHERE TABLE_SCHEMA = 'pediatrico' AND TABLE_NAME = 'medico'
                   AND CONSTRAINT_NAME = 'fk_medico_especialidad') THEN
    ALTER TABLE medico ADD CONSTRAINT fk_medico_especialidad FOREIGN KEY (especialidad)
      REFERENCES especialidad (nombre) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$

DELIMITER ;

CALL migrar_especialidades();
DROP PROCEDURE migrar_especialidades;

-- pedi_app ya puede leer, insertar y actualizar la tabla por el
-- GRANT ... ON pediatrico.* de 03_seguridad.sql (y sigue sin poder borrar).
