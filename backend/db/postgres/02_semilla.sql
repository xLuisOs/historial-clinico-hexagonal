-- =====================================================================
-- Hospital General — datos de prueba
--
-- Usuarios de prueba (contraseña de todos: Hospital#2026)
--   dra.lopez@hospital.gt     médico (Medicina interna)
--   dr.herrera@hospital.gt    médico (Cirugía general)
--   recepcion@hospital.gt     recepción
--   admin@hospital.gt         administrador
-- =====================================================================
SET timezone = 'America/Guatemala';
SET search_path = hospital01;

-- ---------------------------------------------------------------- catálogos
INSERT INTO especialidad (id_especialidad, nombre) VALUES
  (1, 'Medicina interna'), (2, 'Cirugía general'), (3, 'Cardiología'), (4, 'Traumatología');

INSERT INTO departamento (id_departamento, nombre, ubicacion) VALUES
  (1, 'Consulta externa', 'Edificio A, nivel 1'),
  (2, 'Encamamiento',     'Edificio B, niveles 2 y 3'),
  (3, 'Emergencias',      'Edificio A, nivel 0'),
  (4, 'Cuidados intensivos', 'Edificio B, nivel 4');

INSERT INTO habitacion (id_habitacion, numero, departamento_fk, tipo, estado) VALUES
  (1, '201', 2, 'individual', 'ocupada'),
  (2, '202', 2, 'compartida', 'disponible'),
  (3, '203', 2, 'compartida', 'disponible'),
  (4, '401', 4, 'intensivos', 'disponible'),
  (5, '204', 2, 'individual', 'mantenimiento');

INSERT INTO medicamento (id_medicamento, nombre, presentacion, principio_activo) VALUES
  (1, 'Amoxicilina',  'Cápsulas 500 mg',      'Amoxicilina'),
  (2, 'Acetaminofén', 'Tabletas 500 mg',      'Paracetamol'),
  (3, 'Ibuprofeno',   'Tabletas 400 mg',      'Ibuprofeno'),
  (4, 'Omeprazol',    'Cápsulas 20 mg',       'Omeprazol'),
  (5, 'Losartán',     'Tabletas 50 mg',       'Losartán potásico'),
  (6, 'Metformina',   'Tabletas 850 mg',      'Metformina'),
  (7, 'Ceftriaxona',  'Ampolla 1 g',          'Ceftriaxona'),
  (8, 'Tramadol',     'Ampolla 50 mg/mL',     'Tramadol');

-- ------------------------------------------------------------- personal
INSERT INTO medico (id_medico, nombres, apellidos, numero_colegiado, especialidad_fk, departamento_fk, telefono, correo) VALUES
  (1, 'Gabriela María', 'López Ramírez',  '20345', 1, 1, '5530-1122', 'gabriela.lopez@hospital.gt'),
  (2, 'Andrés Eduardo', 'Herrera Solís',  '21876', 2, 2, '5541-3344', 'andres.herrera@hospital.gt'),
  (3, 'Marta Lucía',    'Pineda Orellana','19022', 3, 1, '5552-5566', 'marta.pineda@hospital.gt'),
  (4, 'José Antonio',   'Cruz Méndez',    '22451', 4, 3, '5563-7788', 'jose.cruz@hospital.gt');

INSERT INTO recepcionista (id_recepcionista, nombres, apellidos, telefono) VALUES
  (1, 'Mónica Alejandra', 'Ruiz Barrios', '5577-2233');

INSERT INTO usuario (correo, password_hash, nombre_mostrar, rol, medico_fk, recepcionista_fk) VALUES
  ('dra.lopez@hospital.gt',  '$2b$10$KMDiG3udU.uRRe3.gjyM5etW8zdwusgORDFxPRiHJsuUeXaYG6z36', 'Dra. Gabriela López', 'medico', 1, NULL),
  ('dr.herrera@hospital.gt', '$2b$10$KMDiG3udU.uRRe3.gjyM5etW8zdwusgORDFxPRiHJsuUeXaYG6z36', 'Dr. Andrés Herrera',  'medico', 2, NULL),
  ('recepcion@hospital.gt',  '$2b$10$KMDiG3udU.uRRe3.gjyM5etW8zdwusgORDFxPRiHJsuUeXaYG6z36', 'Mónica Alejandra Ruiz Barrios', 'recepcion', NULL, 1),
  ('admin@hospital.gt',      '$2b$10$KMDiG3udU.uRRe3.gjyM5etW8zdwusgORDFxPRiHJsuUeXaYG6z36', 'Administración',      'admin', NULL, NULL);

-- ------------------------------------------------------------ pacientes
INSERT INTO paciente (id_paciente, nombres, apellidos, fecha_nacimiento, sexo, dpi, telefono, direccion, correo, tipo_sangre, fecha_registro) VALUES
  (1, 'Carlos Enrique', 'Morales Pérez',   '1968-03-22', 'M', '1845632170101', '5590-1234', 'Zona 11, Guatemala',  'carlos.morales@correo.gt', 'O+',  localtimestamp - interval '200 days'),
  (2, 'Lucía Fernanda', 'García Monzón',   '1985-07-09', 'F', '2034567810101', '4412-9988', 'Zona 15, Guatemala',  NULL,                       'A+',  localtimestamp - interval '120 days'),
  (3, 'Roberto',        'Estrada Castillo','1952-11-30', 'M', '1623498750108', '3388-4455', 'Villa Nueva',         NULL,                       'B-',  localtimestamp - interval '60 days'),
  (4, 'Valeria Isabel', 'Rodas Figueroa',  '2009-02-14', 'F', NULL,            '5021-7788', 'Mixco',               NULL,                       NULL,  localtimestamp - interval '30 days');

INSERT INTO responsable (id_responsable, nombres, apellidos, dpi, telefono, direccion) VALUES
  (1, 'Ana Beatriz',  'Pérez de Morales', '1934567810101', '5590-4321', 'Zona 11, Guatemala'),
  (2, 'Luis Alberto', 'Estrada Gómez',    '2145678920108', '3388-1100', 'Villa Nueva'),
  (3, 'Claudia María','Figueroa Ruiz',    '2256789030101', '5021-3344', 'Mixco');

INSERT INTO paciente_responsable (paciente_fk, responsable_fk, parentesco, es_principal, fecha_inicio) VALUES
  (1, 1, 'conyuge',    true, localtimestamp - interval '200 days'),
  (3, 2, 'hijo',       true, localtimestamp - interval '60 days'),
  (4, 3, 'madre',      true, localtimestamp - interval '30 days');

-- ------------------------------------------------------- citas y consultas
INSERT INTO cita (id_cita, paciente_fk, medico_fk, fecha_hora, estado, motivo) VALUES
  (1, 1, 1, date_trunc('day', localtimestamp) - interval '30 days' + interval '9 hours',  'atendida',   'Control de presión arterial'),
  (2, 2, 1, date_trunc('day', localtimestamp) - interval '12 days' + interval '10 hours', 'atendida',   'Dolor de garganta y fiebre'),
  (3, 1, 3, date_trunc('day', localtimestamp) + interval '4 days'  + interval '8 hours',  'programada', 'Evaluación cardiológica'),
  (4, 2, 1, date_trunc('day', localtimestamp) + interval '6 days'  + interval '11 hours', 'programada', 'Control post tratamiento'),
  (5, 4, 4, date_trunc('day', localtimestamp) - interval '5 days'  + interval '15 hours', 'no_asistio', 'Dolor de rodilla');

INSERT INTO consulta (id_consulta, cita_fk, paciente_fk, medico_fk, fecha_hora_atencion, motivo_consulta, es_emergencia) VALUES
  (1, 1,    1, 1, date_trunc('day', localtimestamp) - interval '30 days' + interval '9 hours 10 minutes',  'Control de presión arterial', false),
  (2, 2,    2, 1, date_trunc('day', localtimestamp) - interval '12 days' + interval '10 hours 5 minutes',  'Dolor de garganta y fiebre',  false),
  -- Emergencia sin cita que terminó en internamiento.
  (3, NULL, 3, 2, date_trunc('day', localtimestamp) - interval '3 days'  + interval '22 hours 40 minutes', 'Dolor abdominal intenso',     true);

INSERT INTO diagnostico (consulta_fk, codigo_cie10, descripcion, tipo) VALUES
  (1, 'I10',   'Hipertensión esencial',                  'principal'),
  (1, 'E11.9', 'Diabetes mellitus tipo 2 sin complicaciones', 'secundario'),
  (2, 'J02.9', 'Faringitis aguda',                       'principal'),
  (3, 'K35.8', 'Apendicitis aguda',                      'principal');

INSERT INTO tratamiento (consulta_fk, internamiento_fk, descripcion, fecha_inicio, fecha_fin, indicaciones) VALUES
  (1, NULL, 'Control de presión y glucosa', current_date - 30, NULL,              'Dieta baja en sal y azúcar; caminar 30 minutos diarios'),
  (2, NULL, 'Antibiótico oral',             current_date - 12, current_date - 5,  'Completar los 7 días aunque mejoren los síntomas');

INSERT INTO receta (id_receta, consulta_fk, internamiento_fk, medico_fk, fecha_emision, indicaciones) VALUES
  (1, 1, NULL, 1, current_date - 30, 'Tomar todos los días a la misma hora'),
  (2, 2, NULL, 1, current_date - 12, NULL);

INSERT INTO detalle_receta (receta_fk, medicamento_fk, dosis, frecuencia, duracion_dias, via, indicaciones) VALUES
  (1, 5, '1 tableta', 'cada 24 horas', 90, 'oral', NULL),
  (1, 6, '1 tableta', 'cada 12 horas', 90, 'oral', 'Con las comidas'),
  (2, 1, '1 cápsula', 'cada 8 horas',  7,  'oral', NULL),
  (2, 2, '1 tableta', 'cada 6 horas',  3,  'oral', 'Solo si hay fiebre');

-- --------------------------------------------------------- internamiento
INSERT INTO internamiento (id_internamiento, paciente_fk, habitacion_fk, medico_responsable_fk, fecha_ingreso, motivo_ingreso, diagnostico_ingreso, estado) VALUES
  (1, 3, 1, 2, date_trunc('day', localtimestamp) - interval '3 days' + interval '23 hours', 'Apendicectomía de emergencia', 'Apendicitis aguda', 'activo');

INSERT INTO internamiento_medico (internamiento_fk, medico_fk, fecha_inicio, fecha_fin, motivo_cambio) VALUES
  (1, 4, date_trunc('day', localtimestamp) - interval '3 days' + interval '23 hours', date_trunc('day', localtimestamp) - interval '2 days' + interval '8 hours', 'Médico de turno en emergencias'),
  (1, 2, date_trunc('day', localtimestamp) - interval '2 days' + interval '8 hours',  NULL, 'Cirujano a cargo');

INSERT INTO tratamiento (consulta_fk, internamiento_fk, descripcion, fecha_inicio, fecha_fin, indicaciones) VALUES
  (NULL, 1, 'Apendicectomía laparoscópica', current_date - 2, current_date - 2, NULL),
  (NULL, 1, 'Antibiótico intravenoso',      current_date - 2, NULL,             'Vigilar temperatura cada 4 horas');

INSERT INTO receta (id_receta, consulta_fk, internamiento_fk, medico_fk, fecha_emision, indicaciones) VALUES
  (3, NULL, 1, 2, current_date - 2, 'Uso hospitalario');

INSERT INTO detalle_receta (receta_fk, medicamento_fk, dosis, frecuencia, duracion_dias, via, indicaciones) VALUES
  (3, 7, '1 g',   'cada 24 horas', 5, 'intravenosa',   NULL),
  (3, 8, '50 mg', 'cada 8 horas',  3, 'intramuscular', 'Solo si hay dolor');

-- ------------------------------------------------------------ facturación
INSERT INTO factura (id_factura, paciente_fk, consulta_fk, internamiento_fk, fecha_emision) VALUES
  (1, 1, 1, NULL, date_trunc('day', localtimestamp) - interval '30 days' + interval '10 hours'),
  (2, 2, 2, NULL, date_trunc('day', localtimestamp) - interval '12 days' + interval '11 hours'),
  (3, 3, NULL, 1, date_trunc('day', localtimestamp) - interval '2 days'  + interval '9 hours');

-- El total de cada factura lo calcula el trigger a partir de este detalle.
INSERT INTO detalle_factura (factura_fk, descripcion, cantidad, precio_unitario) VALUES
  (1, 'Consulta de medicina interna', 1, 300.00),
  (1, 'Glucometría',                  1,  50.00),
  (2, 'Consulta de medicina interna', 1, 300.00),
  (3, 'Apendicectomía laparoscópica', 1, 8500.00),
  (3, 'Día de encamamiento',          2, 750.00);

-- Pago completo, pago completo y abono parcial (los triggers validan el saldo
-- y cierran la factura cuando se completa).
INSERT INTO pago (factura_fk, fecha_pago, monto, metodo_pago, referencia) VALUES
  (1, date_trunc('day', localtimestamp) - interval '30 days' + interval '10 hours 5 minutes', 350.00,  'efectivo', NULL),
  (2, date_trunc('day', localtimestamp) - interval '12 days' + interval '11 hours 2 minutes', 300.00,  'tarjeta',  '558812'),
  (3, date_trunc('day', localtimestamp) - interval '2 days'  + interval '9 hours 30 minutes', 5000.00, 'seguro',   'POL-77120');

-- ------------------------------------------------------------ antecedentes
INSERT INTO antecedente (paciente_fk, tipo, descripcion, anio_inicio, registrado_por, fecha_registro) VALUES
  (1, 'patologico',  'Hipertensión arterial',                         2012, 1, localtimestamp - interval '200 days'),
  (1, 'patologico',  'Diabetes mellitus tipo 2',                      2018, 1, localtimestamp - interval '200 days'),
  (1, 'familiar',    'Padre: infarto agudo de miocardio a los 60 años', NULL, 1, localtimestamp - interval '200 days'),
  (1, 'medicamento', 'Losartán 50 mg cada 24 horas',                  2012, 1, localtimestamp - interval '200 days'),
  (1, 'medicamento', 'Metformina 850 mg cada 12 horas',               2018, 1, localtimestamp - interval '200 days'),
  (2, 'quirurgico',  'Cesárea',                                       2016, 2, localtimestamp - interval '120 days'),
  (2, 'familiar',    'Madre: hipotiroidismo',                         NULL, 2, localtimestamp - interval '120 days'),
  (3, 'patologico',  'Enfermedad pulmonar obstructiva crónica (EPOC)', 2015, 4, localtimestamp - interval '60 days'),
  (3, 'quirurgico',  'Colecistectomía',                               2010, 4, localtimestamp - interval '60 days'),
  (3, 'habito',      'Exfumador: una cajetilla diaria por 30 años, dejó en 2015', NULL, 4, localtimestamp - interval '60 days'),
  (4, 'patologico',  'Asma bronquial',                                2014, 2, localtimestamp - interval '30 days'),
  (4, 'familiar',    'Madre: asma',                                   NULL, 2, localtimestamp - interval '30 days');

-- Como varios inserts llevan id explícito, cada tabla sigue numerando desde su último id.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'hospital01' AND c.is_identity = 'YES'
  LOOP
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE((SELECT max(%I) FROM hospital01.%I), 0) + 1, false)',
      'hospital01.' || r.table_name, r.column_name, r.column_name, r.table_name);
  END LOOP;
END $$;
