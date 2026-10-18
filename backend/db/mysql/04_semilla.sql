-- =====================================================================
-- Centro Médico Pediátrico — datos de prueba
--
-- Usuarios de prueba (contraseña de todos: Pediatrico#2026)
--   dra.morales@pediatrico.gt   médico
--   dr.castillo@pediatrico.gt   médico
--   recepcion@pediatrico.gt     recepción
--   admin@pediatrico.gt         administrador
-- =====================================================================
USE pediatrico;

-- ---------------------------------------------------------------- catálogos
INSERT INTO servicio (id_servicio, nombre, descripcion, precio) VALUES
  (1, 'Consulta general',       'Consulta pediátrica por morbilidad',            150.00),
  (2, 'Control de niño sano',   'Evaluación de crecimiento y desarrollo',        125.00),
  (3, 'Aplicación de vacuna',   'Administración de una dosis del esquema',        50.00),
  (4, 'Nebulización',           'Sesión de nebulización con broncodilatador',     75.00);

INSERT INTO vacuna (id_vacuna, nombre, dosis_total, servicio_fk) VALUES
  (1, 'BCG',                    1, 3),
  (2, 'Hepatitis B pediátrica', 1, 3),
  (3, 'Pentavalente',           3, 3),
  (4, 'Polio',                  5, 3),
  (5, 'Rotavirus',              2, 3),
  (6, 'Neumococo conjugada',    3, 3),
  (7, 'SPR',                    2, 3),
  (8, 'DPT refuerzo',           2, 3);

-- Basado en el esquema nacional de vacunación de Guatemala (simplificado).
INSERT INTO esquema_dosis (vacuna_fk, numero_dosis, edad_recomendada_meses) VALUES
  (1, 1, 0),
  (2, 1, 0),
  (3, 1, 2), (3, 2, 4), (3, 3, 6),
  (4, 1, 2), (4, 2, 4), (4, 3, 6), (4, 4, 18), (4, 5, 48),
  (5, 1, 2), (5, 2, 4),
  (6, 1, 2), (6, 2, 4), (6, 3, 12),
  (7, 1, 12), (7, 2, 18),
  (8, 1, 18), (8, 2, 48);

INSERT INTO medicamento (id_medicamento, nombre_generico, presentacion) VALUES
  (1, 'Amoxicilina',                 'Suspensión 250 mg/5 mL'),
  (2, 'Acetaminofén',                'Gotas 100 mg/mL'),
  (3, 'Acetaminofén',                'Jarabe 160 mg/5 mL'),
  (4, 'Ibuprofeno',                  'Suspensión 100 mg/5 mL'),
  (5, 'Salbutamol',                  'Inhalador 100 mcg/dosis'),
  (6, 'Sales de rehidratación oral', 'Sobre 20.5 g'),
  (7, 'Loratadina',                  'Jarabe 5 mg/5 mL'),
  (8, 'Sulfato de zinc',             'Jarabe 20 mg/5 mL');

INSERT INTO metodo_pago (id_metodo_pago, nombre) VALUES
  (1, 'efectivo'), (2, 'tarjeta'), (3, 'transferencia');

-- ------------------------------------------------------------- personal
INSERT INTO medico (id_medico, nombres, apellidos, especialidad, numero_colegiado) VALUES
  (1, 'Ana Lucía',  'Morales Pérez',   'Pediatría general', '12345'),
  (2, 'Carlos',     'Castillo Ruiz',   'Neumología pediátrica', '15872'),
  (3, 'Sofía',      'Hernández López', 'Pediatría general', '18230');

INSERT INTO usuario (correo, password_hash, nombre_mostrar, rol, medico_fk) VALUES
  ('dra.morales@pediatrico.gt', '$2b$10$3Y.vsq.9Pl6ylP6EJP9nr.zIKK6CsMaKZ1weysaz1wVQ18b3u/30i', 'Dra. Ana Lucía Morales', 'medico', 1),
  ('dr.castillo@pediatrico.gt', '$2b$10$3Y.vsq.9Pl6ylP6EJP9nr.zIKK6CsMaKZ1weysaz1wVQ18b3u/30i', 'Dr. Carlos Castillo',    'medico', 2),
  ('recepcion@pediatrico.gt',   '$2b$10$3Y.vsq.9Pl6ylP6EJP9nr.zIKK6CsMaKZ1weysaz1wVQ18b3u/30i', 'Recepción',              'recepcion', NULL),
  ('admin@pediatrico.gt',       '$2b$10$3Y.vsq.9Pl6ylP6EJP9nr.zIKK6CsMaKZ1weysaz1wVQ18b3u/30i', 'Administración',         'admin', NULL);

-- ------------------------------------------------------------- pacientes
INSERT INTO encargado (id_encargado, nombres, apellidos, parentesco, dpi, telefono, direccion, correo) VALUES
  (1, 'María José', 'García López',  'madre',  '2456789010101', '5555-1234', '5a avenida 10-20, zona 1, Guatemala', 'mariajose.garcia@correo.gt'),
  (2, 'Jorge',      'Ramírez Soto',  'padre',  '3012456780101', '4444-9876', 'Calzada Roosevelt 22-45, zona 11',    NULL),
  (3, 'Elena',      'Juárez Méndez', 'abuela', '1987654320101', '3333-4567', 'Mixco, colonia El Naranjo',            NULL);

INSERT INTO paciente (id_paciente, nombres, apellidos, fecha_nacimiento, sexo, cui, encargado_fk, tipo_sangre, alergias, fecha_registro) VALUES
  (1, 'Valentina', 'Pérez García',   '2025-06-10', 'F', '4012345670101', 1, 'O+', NULL,          '2025-06-12 09:00:00'),
  (2, 'Mateo',     'Pérez García',   '2022-03-02', 'M', '3987654320101', 1, 'O+', 'Penicilina',  '2022-03-05 10:30:00'),
  (3, 'Diego',     'Ramírez Juárez', '2019-11-21', 'M', NULL,            2, 'A+', NULL,          '2020-01-10 08:15:00'),
  (4, 'Camila',    'Juárez Ortiz',   '2021-08-15', 'F', NULL,            3, NULL, NULL,          '2021-09-01 11:00:00');

-- ---------------------------------------------- citas, consultas, recetas
INSERT INTO cita (id_cita, paciente_fk, medico_fk, fecha_hora_programada, motivo_cita, estado_cita, fecha_registro) VALUES
  (1, 1, 1, '2025-08-12 09:00:00', 'Control de niño sano 2 meses', 'atendida',   '2025-08-01 10:00:00'),
  (2, 1, 1, '2025-10-14 09:30:00', 'Control de niño sano 4 meses', 'atendida',   '2025-10-01 10:00:00'),
  (3, 1, 1, '2026-06-15 10:00:00', 'Control de niño sano 12 meses','atendida',   '2026-06-01 10:00:00'),
  (4, 1, 2, '2026-09-20 16:00:00', 'Tos y fiebre de 3 días',       'atendida',   '2026-09-20 15:10:00'),
  (5, 2, 2, '2026-08-05 11:00:00', 'Crisis de sibilancias',        'atendida',   '2026-08-05 08:00:00'),
  (6, 1, 1, '2026-12-10 09:00:00', 'Control de niño sano 18 meses','programada', '2026-10-01 12:00:00'),
  (7, 3, 3, '2026-10-20 15:00:00', 'Dolor de oído',                'confirmada', '2026-10-15 09:00:00'),
  (8, 4, 3, '2024-05-10 08:30:00', 'Diarrea aguda',                'atendida',   '2024-05-10 07:45:00');

INSERT INTO consulta (id_consulta, cita_fk, fecha_hora_real, peso_kg, talla_cm, perimetro_cefalico_cm, observaciones) VALUES
  (1, 1, '2025-08-12 09:10:00',  5.40, 57.5, 39.0, 'Desarrollo psicomotor adecuado para la edad.'),
  (2, 2, '2025-10-14 09:40:00',  6.80, 63.0, 41.5, 'Lactancia materna exclusiva. Sin hallazgos.'),
  (3, 3, '2026-06-15 10:05:00',  9.30, 74.5, 45.5, 'Inicia marcha con apoyo. Buen apetito.'),
  (4, 4, '2026-09-20 16:20:00', 10.10, 78.0, NULL, 'Rinorrea, tos húmeda, T 38.4 °C. Tímpanos normales.'),
  (5, 5, '2026-08-05 11:15:00', 16.20, 101.0, NULL, 'Sibilancias espiratorias bilaterales, SatO2 94 %.'),
  (6, 8, '2024-05-10 08:40:00', 12.00, 86.0, NULL, 'Deshidratación leve.');

INSERT INTO diagnostico (consulta_fk, codigo_cie10, descripcion, tipo) VALUES
  (1, 'Z00.1', 'Control de salud de rutina del niño',            'principal'),
  (2, 'Z00.1', 'Control de salud de rutina del niño',            'principal'),
  (3, 'Z00.1', 'Control de salud de rutina del niño',            'principal'),
  (4, 'J06.9', 'Infección aguda de las vías respiratorias superiores', 'principal'),
  (4, 'R50.9', 'Fiebre no especificada',                         'secundario'),
  (5, 'J45.9', 'Asma no especificada',                           'principal'),
  (6, 'A09',   'Diarrea y gastroenteritis de presunto origen infeccioso', 'principal'),
  (6, 'E86',   'Deshidratación leve',                            'secundario');

INSERT INTO receta (id_receta, consulta_fk, fecha_emision, indicaciones_generales) VALUES
  (1, 4, '2026-09-20 16:35:00', 'Abundantes líquidos. Regresar si la fiebre dura más de 48 horas.'),
  (2, 5, '2026-08-05 11:30:00', 'Evitar exposición a humo y polvo.'),
  (3, 6, '2024-05-10 08:55:00', 'Continuar alimentación habitual.');

INSERT INTO detalle_receta (receta_fk, medicamento_fk, dosis, frecuencia, duracion_dias, via, indicaciones) VALUES
  (1, 2, '15 gotas',   'cada 6 horas si hay fiebre', 3, 'oral', 'No exceder 4 tomas al día'),
  (2, 5, '2 puffs',    'cada 6 horas',               5, 'inhalada', 'Usar con espaciador'),
  (3, 6, '1 sobre en 1 L de agua', 'después de cada evacuación', 3, 'oral', NULL),
  (3, 8, '2.5 mL',     'cada 24 horas',              10, 'oral', NULL);

-- ------------------------------------------------------------- vacunas
INSERT INTO vacuna_aplicada (paciente_fk, vacuna_fk, numero_dosis, medico_fk, consulta_fk, fecha_aplicacion, lote) VALUES
  (1, 1, 1, 1, NULL, '2025-06-11', 'BCG-25-0412'),
  (1, 2, 1, 1, NULL, '2025-06-11', 'HB-25-1180'),
  (1, 3, 1, 1, 1,    '2025-08-12', 'PENTA-25-0733'),
  (1, 4, 1, 1, 1,    '2025-08-12', 'IPV-25-0219'),
  (1, 5, 1, 1, 1,    '2025-08-12', 'ROTA-25-0551'),
  (1, 6, 1, 1, 1,    '2025-08-12', 'PCV-25-0904'),
  (1, 3, 2, 1, 2,    '2025-10-14', 'PENTA-25-0988'),
  (1, 4, 2, 1, 2,    '2025-10-14', 'IPV-25-0302'),
  (1, 5, 2, 1, 2,    '2025-10-14', 'ROTA-25-0610'),
  (1, 6, 2, 1, 2,    '2025-10-14', 'PCV-25-1022'),
  (1, 7, 1, 1, 3,    '2026-06-15', 'SPR-26-0144'),
  (1, 6, 3, 1, 3,    '2026-06-15', 'PCV-26-0077');

-- ------------------------------------------------------- cobros y pagos
INSERT INTO cobro (id_cobro, consulta_fk, encargado_fk, fecha_cobro) VALUES
  (1, 3, 1, '2026-06-15 10:30:00'),
  (2, 4, 1, '2026-09-20 16:40:00');

INSERT INTO detalle_cobro (cobro_fk, servicio_fk, cantidad, precio_unitario) VALUES
  (1, 2, 1, 125.00),
  (1, 3, 2,  50.00),
  (2, 1, 1, 150.00);

-- El cobro 1 queda pagado (lo cierra el trigger); el 2 queda con saldo pendiente.
INSERT INTO pago (cobro_fk, metodo_pago_fk, monto, fecha_pago, referencia) VALUES
  (1, 2, 225.00, '2026-06-15 10:35:00', '4821'),
  (2, 1, 100.00, '2026-09-20 16:45:00', NULL);

-- ------------------------------------------------- historial archivado
UPDATE paciente
SET activo = FALSE, fecha_baja = '2025-01-20 14:00:00', motivo_baja = 'traslado',
    detalle_baja = 'Familia se mudó a Quetzaltenango; expediente trasladado.'
WHERE id_paciente = 4;
