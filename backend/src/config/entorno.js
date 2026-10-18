import dotenv from 'dotenv';

dotenv.config({ quiet: true });

function requerida(nombre) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre} (revisa backend/.env)`);
  return valor;
}

export const entorno = {
  puerto: Number(process.env.PORT ?? 4000),
  jwtSecreto: requerida('JWT_SECRET'),
  jwtExpira: process.env.JWT_EXPIRA ?? '8h',
  corsOrigen: process.env.CORS_ORIGIN ?? 'http://localhost:5173',

  mysql: {
    url: process.env.MYSQL_URL,
    ca: process.env.MYSQL_SSL_CA,
    zonaHoraria: process.env.ZONA_HORARIA ?? '-06:00',
  },
  mongo: {
    url: process.env.MONGO_URL,
    db: process.env.MONGO_DB ?? 'laboratorio',
  },
  postgres: {
    url: process.env.POSTGRES_URL,
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    credenciales: process.env.FIREBASE_CREDENTIALS,
  },
};
