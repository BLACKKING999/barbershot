const admin = require('firebase-admin');
require('dotenv').config();

/**
 * Firebase Admin SDK initialization
 * In production, you should use environment variables for all sensitive credentials
 */
const initializeFirebaseAdmin = () => {
  if (admin.apps.length) return;

  try {
    // Verificar que todas las variables de entorno necesarias existan
    const requiredEnvVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_CLIENT_ID'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Variables de entorno faltantes: ${missingVars.join(', ')}`);
    }

    // Crear objeto de credenciales desde variables de entorno
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL.replace(/@/g, '%40')}`,
      universe_domain: "googleapis.com"
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    throw error;
  }
};

// Solo inicializar Firebase Admin si las credenciales están disponibles
try {
  const serviceAccount = require('../google-credentials.json');
  
  // Verificar que el archivo tiene la estructura correcta
  if (serviceAccount && serviceAccount.project_id) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin SDK initialized successfully');
  } else {
    console.log('⚠️ Firebase Admin SDK: Credenciales de servicio no válidas');
  }
} catch (error) {
  console.log('⚠️ Firebase Admin SDK: No se pudieron cargar las credenciales de servicio');
  console.log('💡 Para usar notificaciones push, necesitas las credenciales de servicio de Firebase');
}

module.exports = { initializeFirebaseAdmin, admin }; 