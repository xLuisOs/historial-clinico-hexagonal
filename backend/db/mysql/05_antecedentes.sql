-- =====================================================================
-- Centro Médico Pediátrico — agrega ANTECEDENTE a una base que ya existe.
--
-- Solo hace falta si la base se creó antes de que 01_esquema.sql trajera la
-- tabla antecedente:   npm run db:mysql -- --solo 05_antecedentes.sql
-- No borra ni cambia nada de lo que ya hay y se puede correr más de una vez.
-- En una base nueva no hace nada (la tabla ya existe y ya tiene datos).
-- =====================================================================
USE pediatrico;

CREATE TABLE IF NOT EXISTS antecedente (
  id_antecedente  INT AUTO_INCREMENT PRIMARY KEY,
  paciente_fk     INT          NOT NULL,
  tipo            VARCHAR(12)  NOT NULL,
  descripcion     VARCHAR(300) NOT NULL,               -- confidencial
  anio_inicio     SMALLINT     NULL,                   -- año aproximado
  registrado_por  INT          NOT NULL,
  fecha_registro  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_antecedente_tipo CHECK (tipo IN
    ('patologico','quirurgico','familiar','habito','medicamento','perinatal')),
  CONSTRAINT chk_antecedente_anio CHECK (anio_inicio IS NULL OR anio_inicio BETWEEN 1900 AND 2100),
  CONSTRAINT chk_antecedente_perinatal CHECK (tipo <> 'perinatal' OR anio_inicio IS NULL),
  CONSTRAINT fk_antecedente_paciente FOREIGN KEY (paciente_fk)
    REFERENCES paciente (id_paciente) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_antecedente_medico FOREIGN KEY (registrado_por)
    REFERENCES medico (id_medico) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_antecedente_paciente (paciente_fk)
) ENGINE=InnoDB;

DELIMITER $$

CREATE TRIGGER IF NOT EXISTS trg_antecedente_paciente_activo
BEFORE INSERT ON antecedente
FOR EACH ROW
BEGIN
  IF (SELECT activo FROM paciente WHERE id_paciente = NEW.paciente_fk) = FALSE THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial del paciente está archivado';
  END IF;
END$$

DELIMITER ;

-- pedi_app ya puede leer, insertar y actualizar la tabla por el
-- GRANT ... ON pediatrico.* de 03_seguridad.sql (y sigue sin poder borrar).

-- Datos de prueba, solo si la tabla está vacía y existen los pacientes
-- activos de 04_semilla.sql (al 4, archivado, ya no se le pueden agregar).
INSERT INTO antecedente (paciente_fk, tipo, descripcion, anio_inicio, registrado_por, fecha_registro)
SELECT d.* FROM (
  SELECT 1 AS paciente_fk, 'perinatal' AS tipo, 'A término (39 semanas), parto vaginal, peso al nacer 3.2 kg' AS descripcion, NULL AS anio_inicio, 1 AS registrado_por, TIMESTAMP '2025-08-12 09:10:00' AS fecha_registro
  UNION ALL SELECT 1, 'familiar',    'Hermano: asma bronquial',                                             NULL, 1, TIMESTAMP '2025-08-12 09:10:00'
  UNION ALL SELECT 2, 'perinatal',   'Prematuro de 34 semanas, peso al nacer 2.1 kg; 5 días en incubadora', NULL, 2, TIMESTAMP '2026-08-05 11:10:00'
  UNION ALL SELECT 2, 'patologico',  'Asma bronquial',                                                      2024, 2, TIMESTAMP '2026-08-05 11:10:00'
  UNION ALL SELECT 2, 'medicamento', 'Salbutamol inhalado, 2 disparos cuando hay sibilancias',               2024, 2, TIMESTAMP '2026-08-05 11:10:00'
  UNION ALL SELECT 2, 'familiar',    'Madre: rinitis alérgica',                                             NULL, 2, TIMESTAMP '2026-08-05 11:10:00'
  UNION ALL SELECT 3, 'quirurgico',  'Amigdalectomía',                                                      2024, 1, TIMESTAMP '2025-02-10 08:30:00'
  UNION ALL SELECT 3, 'habito',      'Expuesto a humo de tabaco en casa (el padre fuma)',                   NULL, 1, TIMESTAMP '2025-02-10 08:30:00'
) AS d
WHERE NOT EXISTS (SELECT 1 FROM antecedente)
  AND (SELECT COUNT(*) FROM paciente WHERE id_paciente IN (1, 2, 3) AND activo = TRUE) = 3
  AND (SELECT COUNT(*) FROM medico WHERE id_medico IN (1, 2)) = 2;
