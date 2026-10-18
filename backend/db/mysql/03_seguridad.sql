-- =====================================================================
-- Centro Médico Pediátrico — usuarios de base de datos (mínimo privilegio)
--
-- Las contraseñas NO se escriben aquí: el script scripts/mysql-aplicar.js
-- reemplaza los marcadores __...__ con las variables del archivo .env.
-- =====================================================================

-- Usuario con el que se conecta el backend: puede leer, insertar y actualizar,
-- pero NO borrar ni alterar estructura. Así, aunque alguien comprometa la
-- aplicación, no puede eliminar historiales clínicos.
CREATE USER IF NOT EXISTS 'pedi_app'@'%' IDENTIFIED BY '__MYSQL_APP_PASSWORD__';
ALTER USER 'pedi_app'@'%' IDENTIFIED BY '__MYSQL_APP_PASSWORD__';
GRANT SELECT, INSERT, UPDATE ON pediatrico.* TO 'pedi_app'@'%';

-- Usuario de solo lectura para reportes: solo ve datos públicos y catálogos,
-- nunca diagnósticos, alergias, documentos ni contactos.
CREATE USER IF NOT EXISTS 'pedi_lectura'@'%' IDENTIFIED BY '__MYSQL_LECTURA_PASSWORD__';
ALTER USER 'pedi_lectura'@'%' IDENTIFIED BY '__MYSQL_LECTURA_PASSWORD__';
GRANT SELECT ON pediatrico.v_paciente_publico TO 'pedi_lectura'@'%';
GRANT SELECT ON pediatrico.v_cobro_resumen    TO 'pedi_lectura'@'%';
GRANT SELECT ON pediatrico.medico             TO 'pedi_lectura'@'%';
GRANT SELECT ON pediatrico.servicio           TO 'pedi_lectura'@'%';
GRANT SELECT ON pediatrico.vacuna             TO 'pedi_lectura'@'%';
GRANT SELECT ON pediatrico.esquema_dosis      TO 'pedi_lectura'@'%';
GRANT SELECT ON pediatrico.medicamento        TO 'pedi_lectura'@'%';
