-- =====================================================================
-- Centro Médico Pediátrico — MySQL 8
-- Esquema relacional corregido (Entrega II)
--
-- Cambios respecto a la Entrega I:
--   * Restricciones NOT NULL / CHECK / UNIQUE explícitas en todas las tablas.
--   * nombre_completo se separa en nombres + apellidos (igual que el hospital),
--     para que el modelo de dominio sea el mismo en los cuatro motores.
--   * paciente.cui: documento de identificación del menor (RENAP).
--   * DIAGNOSTICO pasa a ser una tabla (N diagnósticos por consulta, CIE-10),
--     en lugar de un varchar dentro de CONSULTA.
--   * Se agregan MEDICAMENTO, RECETA y DETALLE_RECETA (regla "recetar medicamento").
--   * La edad recomendada depende de la DOSIS, no de la vacuna: nueva tabla
--     ESQUEMA_DOSIS (corrige una dependencia parcial, 2FN).
--   * cobro.monto_total se elimina (dato derivado): se calcula en v_cobro_resumen.
--   * detalle_cobro.subtotal es columna generada: no puede quedar inconsistente.
--   * USUARIO para autenticación y enrutamiento por institución.
--   * Todas las FK con ON DELETE RESTRICT: un historial nunca se borra, se archiva.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS pediatrico
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pediatrico;

-- ---------------------------------------------------------------------
-- Personas
-- ---------------------------------------------------------------------
CREATE TABLE encargado (
  id_encargado  INT AUTO_INCREMENT PRIMARY KEY,
  nombres       VARCHAR(100) NOT NULL,
  apellidos     VARCHAR(100) NOT NULL,
  parentesco    VARCHAR(20)  NOT NULL,
  dpi           CHAR(13)     NOT NULL,                 -- restringido
  telefono      VARCHAR(20)  NOT NULL,                 -- confidencial
  direccion     VARCHAR(200) NULL,                     -- confidencial
  correo        VARCHAR(120) NULL,                     -- confidencial
  CONSTRAINT uq_encargado_dpi UNIQUE (dpi),
  CONSTRAINT chk_encargado_dpi CHECK (dpi REGEXP '^[0-9]{13}$'),
  CONSTRAINT chk_encargado_parentesco CHECK (parentesco IN
    ('madre','padre','abuela','abuelo','tia','tio','hermana','hermano','tutor_legal','otro'))
) ENGINE=InnoDB;

CREATE TABLE paciente (
  id_paciente       INT AUTO_INCREMENT PRIMARY KEY,
  nombres           VARCHAR(100) NOT NULL,
  apellidos         VARCHAR(100) NOT NULL,
  fecha_nacimiento  DATE         NOT NULL,
  sexo              CHAR(1)      NOT NULL,
  cui               CHAR(13)     NULL,                 -- restringido
  encargado_fk      INT          NOT NULL,
  tipo_sangre       VARCHAR(3)   NULL,                 -- confidencial
  alergias          VARCHAR(500) NULL,                 -- confidencial
  fecha_registro    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activo            BOOLEAN      NOT NULL DEFAULT TRUE,
  fecha_baja        DATETIME     NULL,                 -- confidencial
  motivo_baja       VARCHAR(20)  NULL,                 -- confidencial
  detalle_baja      VARCHAR(300) NULL,                 -- confidencial
  CONSTRAINT uq_paciente_cui UNIQUE (cui),
  CONSTRAINT chk_paciente_sexo CHECK (sexo IN ('M','F')),
  CONSTRAINT chk_paciente_cui CHECK (cui IS NULL OR cui REGEXP '^[0-9]{13}$'),
  CONSTRAINT chk_paciente_sangre CHECK (tipo_sangre IS NULL OR tipo_sangre IN
    ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  CONSTRAINT chk_paciente_motivo_baja CHECK (motivo_baja IS NULL OR motivo_baja IN
    ('traslado','fallecimiento','mayoria_edad','administrativo','otro')),
  -- Un paciente activo no tiene datos de baja; uno archivado debe tenerlos.
  CONSTRAINT chk_paciente_baja CHECK (
    (activo = TRUE  AND fecha_baja IS NULL     AND motivo_baja IS NULL) OR
    (activo = FALSE AND fecha_baja IS NOT NULL AND motivo_baja IS NOT NULL)),
  CONSTRAINT fk_paciente_encargado FOREIGN KEY (encargado_fk)
    REFERENCES encargado (id_encargado) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_paciente_nombre (apellidos, nombres)
) ENGINE=InnoDB;

CREATE TABLE medico (
  id_medico         INT AUTO_INCREMENT PRIMARY KEY,
  nombres           VARCHAR(100) NOT NULL,
  apellidos         VARCHAR(100) NOT NULL,
  especialidad      VARCHAR(80)  NOT NULL,
  numero_colegiado  VARCHAR(10)  NOT NULL,
  activo            BOOLEAN      NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_medico_colegiado UNIQUE (numero_colegiado)
) ENGINE=InnoDB;

-- Credenciales de acceso. La contraseña se guarda como hash bcrypt (60 caracteres).
CREATE TABLE usuario (
  id_usuario      INT AUTO_INCREMENT PRIMARY KEY,
  correo          VARCHAR(120) NOT NULL,
  password_hash   CHAR(60)     NOT NULL,               -- restringido
  nombre_mostrar  VARCHAR(120) NOT NULL,
  rol             VARCHAR(10)  NOT NULL,
  medico_fk       INT          NULL,
  activo          BOOLEAN      NOT NULL DEFAULT TRUE,
  ultimo_acceso   DATETIME     NULL,
  CONSTRAINT uq_usuario_correo UNIQUE (correo),
  CONSTRAINT uq_usuario_medico UNIQUE (medico_fk),
  CONSTRAINT chk_usuario_rol CHECK (rol IN ('medico','recepcion','admin')),
  CONSTRAINT chk_usuario_medico CHECK (rol <> 'medico' OR medico_fk IS NOT NULL),
  -- ON UPDATE RESTRICT: MySQL no permite CHECK sobre columnas con acción en cascada.
  CONSTRAINT fk_usuario_medico FOREIGN KEY (medico_fk)
    REFERENCES medico (id_medico) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Atención
-- ---------------------------------------------------------------------
CREATE TABLE cita (
  id_cita                INT AUTO_INCREMENT PRIMARY KEY,
  paciente_fk            INT          NOT NULL,
  medico_fk              INT          NOT NULL,
  fecha_hora_programada  DATETIME     NOT NULL,
  motivo_cita            VARCHAR(300) NULL,            -- confidencial
  estado_cita            VARCHAR(12)  NOT NULL DEFAULT 'programada',
  fecha_registro         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_cita_estado CHECK (estado_cita IN
    ('programada','confirmada','atendida','cancelada','no_asistio')),
  CONSTRAINT fk_cita_paciente FOREIGN KEY (paciente_fk)
    REFERENCES paciente (id_paciente) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_cita_medico FOREIGN KEY (medico_fk)
    REFERENCES medico (id_medico) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_cita_medico_fecha (medico_fk, fecha_hora_programada)
) ENGINE=InnoDB;

-- Una cita genera como máximo una consulta. Si el paciente llega sin cita,
-- la aplicación crea la cita en estado 'atendida' dentro de la misma transacción.
CREATE TABLE consulta (
  id_consulta            INT AUTO_INCREMENT PRIMARY KEY,
  cita_fk                INT          NOT NULL,
  fecha_hora_real        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  peso_kg                DECIMAL(5,2) NULL,
  talla_cm               DECIMAL(5,1) NULL,
  perimetro_cefalico_cm  DECIMAL(4,1) NULL,
  observaciones          TEXT         NULL,            -- confidencial
  CONSTRAINT uq_consulta_cita UNIQUE (cita_fk),
  CONSTRAINT chk_consulta_peso  CHECK (peso_kg IS NULL OR peso_kg BETWEEN 0.3 AND 150),
  CONSTRAINT chk_consulta_talla CHECK (talla_cm IS NULL OR talla_cm BETWEEN 20 AND 220),
  CONSTRAINT chk_consulta_pc    CHECK (perimetro_cefalico_cm IS NULL OR perimetro_cefalico_cm BETWEEN 20 AND 70),
  CONSTRAINT fk_consulta_cita FOREIGN KEY (cita_fk)
    REFERENCES cita (id_cita) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE diagnostico (
  id_diagnostico  INT AUTO_INCREMENT PRIMARY KEY,
  consulta_fk     INT          NOT NULL,
  codigo_cie10    VARCHAR(7)   NULL,
  descripcion     VARCHAR(300) NOT NULL,               -- confidencial
  tipo            VARCHAR(10)  NOT NULL DEFAULT 'principal',
  fecha_registro  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Truco para "un solo diagnóstico principal por consulta": la columna vale 1
  -- solo para el principal y NULL para los demás; UNIQUE ignora los NULL.
  es_principal    TINYINT GENERATED ALWAYS AS (IF(tipo = 'principal', 1, NULL)) STORED,
  CONSTRAINT chk_diagnostico_tipo CHECK (tipo IN ('principal','secundario')),
  CONSTRAINT chk_diagnostico_cie10 CHECK (codigo_cie10 IS NULL OR
    codigo_cie10 REGEXP '^[A-Z][0-9]{2}(\\.[0-9A-Z]{1,4})?$'),
  CONSTRAINT uq_diagnostico_principal UNIQUE (consulta_fk, es_principal),
  CONSTRAINT fk_diagnostico_consulta FOREIGN KEY (consulta_fk)
    REFERENCES consulta (id_consulta) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Recetas
-- ---------------------------------------------------------------------
CREATE TABLE medicamento (
  id_medicamento   INT AUTO_INCREMENT PRIMARY KEY,
  nombre_generico  VARCHAR(100) NOT NULL,
  presentacion     VARCHAR(100) NOT NULL,              -- p. ej. 'Suspensión 250 mg/5 mL'
  activo           BOOLEAN      NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_medicamento UNIQUE (nombre_generico, presentacion)
) ENGINE=InnoDB;

-- Una receta por consulta. El médico que la emite se obtiene de consulta → cita
-- (guardarlo aquí sería una dependencia transitiva).
CREATE TABLE receta (
  id_receta               INT AUTO_INCREMENT PRIMARY KEY,
  consulta_fk             INT          NOT NULL,
  fecha_emision           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  indicaciones_generales  VARCHAR(500) NULL,           -- confidencial
  CONSTRAINT uq_receta_consulta UNIQUE (consulta_fk),
  CONSTRAINT fk_receta_consulta FOREIGN KEY (consulta_fk)
    REFERENCES consulta (id_consulta) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE detalle_receta (
  id_detalle_receta  INT AUTO_INCREMENT PRIMARY KEY,
  receta_fk          INT          NOT NULL,
  medicamento_fk     INT          NOT NULL,
  dosis              VARCHAR(60)  NOT NULL,            -- '5 mL', '1 tableta'
  frecuencia         VARCHAR(60)  NOT NULL,            -- 'cada 8 horas'
  duracion_dias      SMALLINT     NOT NULL,
  via                VARCHAR(15)  NOT NULL DEFAULT 'oral',
  indicaciones       VARCHAR(300) NULL,
  CONSTRAINT uq_detalle_receta UNIQUE (receta_fk, medicamento_fk),
  CONSTRAINT chk_detalle_receta_duracion CHECK (duracion_dias BETWEEN 1 AND 365),
  CONSTRAINT chk_detalle_receta_via CHECK (via IN
    ('oral','intramuscular','intravenosa','subcutanea','topica','inhalada','oftalmica','otica','nasal','rectal')),
  CONSTRAINT fk_detalle_receta_receta FOREIGN KEY (receta_fk)
    REFERENCES receta (id_receta) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_detalle_receta_medicamento FOREIGN KEY (medicamento_fk)
    REFERENCES medicamento (id_medicamento) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Vacunación
-- ---------------------------------------------------------------------
CREATE TABLE servicio (
  id_servicio  INT AUTO_INCREMENT PRIMARY KEY,
  nombre       VARCHAR(100)  NOT NULL,
  descripcion  VARCHAR(300)  NULL,
  precio       DECIMAL(10,2) NOT NULL,
  activo       BOOLEAN       NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_servicio_nombre UNIQUE (nombre),
  CONSTRAINT chk_servicio_precio CHECK (precio >= 0)
) ENGINE=InnoDB;

CREATE TABLE vacuna (
  id_vacuna    INT AUTO_INCREMENT PRIMARY KEY,
  nombre       VARCHAR(80) NOT NULL,
  dosis_total  TINYINT     NOT NULL,
  servicio_fk  INT         NULL,                       -- nulo si aún no tiene cargo asociado
  CONSTRAINT uq_vacuna_nombre UNIQUE (nombre),
  CONSTRAINT chk_vacuna_dosis CHECK (dosis_total BETWEEN 1 AND 10),
  CONSTRAINT fk_vacuna_servicio FOREIGN KEY (servicio_fk)
    REFERENCES servicio (id_servicio) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Cada dosis del esquema tiene su propia edad recomendada.
CREATE TABLE esquema_dosis (
  vacuna_fk               INT     NOT NULL,
  numero_dosis            TINYINT NOT NULL,
  edad_recomendada_meses  SMALLINT NOT NULL,
  PRIMARY KEY (vacuna_fk, numero_dosis),
  CONSTRAINT chk_esquema_edad CHECK (edad_recomendada_meses BETWEEN 0 AND 216),
  CONSTRAINT fk_esquema_vacuna FOREIGN KEY (vacuna_fk)
    REFERENCES vacuna (id_vacuna) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE vacuna_aplicada (
  id_vacuna_aplicada  INT AUTO_INCREMENT PRIMARY KEY,
  paciente_fk         INT         NOT NULL,
  vacuna_fk           INT         NOT NULL,
  numero_dosis        TINYINT     NOT NULL,
  medico_fk           INT         NOT NULL,
  consulta_fk         INT         NULL,                -- nulo si se aplicó fuera de consulta
  fecha_aplicacion    DATE        NOT NULL,
  lote                VARCHAR(30) NOT NULL,
  CONSTRAINT uq_vacuna_aplicada UNIQUE (paciente_fk, vacuna_fk, numero_dosis),
  CONSTRAINT fk_va_paciente FOREIGN KEY (paciente_fk)
    REFERENCES paciente (id_paciente) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_va_dosis FOREIGN KEY (vacuna_fk, numero_dosis)
    REFERENCES esquema_dosis (vacuna_fk, numero_dosis) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_va_medico FOREIGN KEY (medico_fk)
    REFERENCES medico (id_medico) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_va_consulta FOREIGN KEY (consulta_fk)
    REFERENCES consulta (id_consulta) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Cobros y pagos
-- ---------------------------------------------------------------------
CREATE TABLE metodo_pago (
  id_metodo_pago  INT AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(30) NOT NULL,
  CONSTRAINT uq_metodo_pago UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE cobro (
  id_cobro      INT AUTO_INCREMENT PRIMARY KEY,
  consulta_fk   INT         NOT NULL,
  encargado_fk  INT         NOT NULL,                  -- responsable del pago
  fecha_cobro   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado_cobro  VARCHAR(10) NOT NULL DEFAULT 'pendiente',
  CONSTRAINT uq_cobro_consulta UNIQUE (consulta_fk),
  CONSTRAINT chk_cobro_estado CHECK (estado_cobro IN ('pendiente','pagado','anulado')),
  CONSTRAINT fk_cobro_consulta FOREIGN KEY (consulta_fk)
    REFERENCES consulta (id_consulta) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_cobro_encargado FOREIGN KEY (encargado_fk)
    REFERENCES encargado (id_encargado) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- precio_unitario se guarda (no se lee del catálogo) porque es el precio
-- vigente al momento del cobro; el catálogo puede cambiar después.
CREATE TABLE detalle_cobro (
  id_detalle_cobro  INT AUTO_INCREMENT PRIMARY KEY,
  cobro_fk          INT           NOT NULL,
  servicio_fk       INT           NOT NULL,
  cantidad          SMALLINT      NOT NULL DEFAULT 1,
  precio_unitario   DECIMAL(10,2) NOT NULL,
  subtotal          DECIMAL(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  CONSTRAINT chk_detalle_cobro_cantidad CHECK (cantidad > 0),
  CONSTRAINT chk_detalle_cobro_precio CHECK (precio_unitario >= 0),
  CONSTRAINT fk_detalle_cobro_cobro FOREIGN KEY (cobro_fk)
    REFERENCES cobro (id_cobro) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_detalle_cobro_servicio FOREIGN KEY (servicio_fk)
    REFERENCES servicio (id_servicio) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE pago (
  id_pago         INT AUTO_INCREMENT PRIMARY KEY,
  cobro_fk        INT           NOT NULL,
  metodo_pago_fk  INT           NOT NULL,
  monto           DECIMAL(10,2) NOT NULL,
  fecha_pago      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  referencia      VARCHAR(40)   NULL,                  -- confidencial
  CONSTRAINT chk_pago_monto CHECK (monto > 0),
  CONSTRAINT fk_pago_cobro FOREIGN KEY (cobro_fk)
    REFERENCES cobro (id_cobro) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_pago_metodo FOREIGN KEY (metodo_pago_fk)
    REFERENCES metodo_pago (id_metodo_pago) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------
CREATE VIEW v_cobro_resumen AS
SELECT c.id_cobro,
       c.consulta_fk,
       c.encargado_fk,
       c.fecha_cobro,
       c.estado_cobro,
       COALESCE((SELECT SUM(d.subtotal) FROM detalle_cobro d WHERE d.cobro_fk = c.id_cobro), 0) AS monto_total,
       COALESCE((SELECT SUM(p.monto)    FROM pago p          WHERE p.cobro_fk = c.id_cobro), 0) AS monto_pagado
FROM cobro c;

-- Vista sin datos confidenciales ni restringidos, para reportes y para el rol de solo lectura.
CREATE VIEW v_paciente_publico AS
SELECT id_paciente, nombres, apellidos, fecha_nacimiento, sexo, fecha_registro, activo
FROM paciente;
