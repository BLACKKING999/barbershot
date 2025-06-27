// src/config/database.js
/**
 * Configuración de la conexión a la base de datos MySQL
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST ,
  user: process.env.DB_USER ,
  password: process.env.DB_PASSWORD ,
  database: process.env.DB_NAME ,
  port: process.env.DB_PORT ,
  charset: 'utf8mb4',
  timezone: '+00:00',
  connectionLimit: 10,
  queueLimit: 0,
  waitForConnections: true
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Función para inicializar la base de datos
const inicializarBaseDatos = async () => {
  try {
    // Verificar conexión
    const connection = await pool.getConnection();
    console.log('✅ Conexión a la base de datos establecida correctamente');
    
    // Verificar que las tablas principales existan
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN ('usuarios', 'roles', 'clientes', 'empleados', 'citas', 'servicios')
    `, [dbConfig.database]);
    
    if (tables.length < 6) {
      throw new Error('Faltan tablas principales en la base de datos');
    }
    
    console.log('✅ Tablas principales verificadas correctamente');
    
    // Verificar estructura de la tabla usuarios
    const [userColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'usuarios'
    `, [dbConfig.database]);
    
    const requiredColumns = [
      'id', 'firebase_uid', 'email', 'nombre', 'apellido', 
      'telefono', 'foto_perfil', 'rol_id', 'activo', 
      'fecha_registro', 'ultimo_acceso', 'notificacion_correo',
      'notificacion_push', 'notificacion_sms', 'recordatorio_horas_antes',
      'created_at', 'updated_at'
    ];
    
    const existingColumns = userColumns.map(col => col.COLUMN_NAME);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.warn('⚠️ Columnas faltantes en tabla usuarios:', missingColumns);
    }
    
    connection.release();
    console.log('✅ Estructura de base de datos verificada correctamente');
    
  } catch (error) {
    console.error('❌ Error inicializando la base de datos:', error);
    throw error;
  }
};

// Función para cerrar el pool de conexiones
const cerrarConexion = async () => {
  try {
    await pool.end();
    console.log('✅ Conexión a la base de datos cerrada correctamente');
  } catch (error) {
    console.error('❌ Error cerrando la conexión:', error);
  }
};

// Middleware para manejar errores de conexión
const manejarErrorConexion = (error) => {
  console.error('Error de conexión a la base de datos:', error);
  
  if (error.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('Conexión perdida. Reintentando...');
  } else if (error.code === 'ER_CON_COUNT_ERROR') {
    console.log('Demasiadas conexiones a la base de datos.');
  } else if (error.code === 'ECONNREFUSED') {
    console.log('Conexión rechazada por la base de datos.');
  } else {
    console.log('Error desconocido de la base de datos.');
  }
};

// Event listeners para el pool
pool.on('connection', (connection) => {
  console.log('Nueva conexión establecida con la base de datos');
  
  connection.on('error', (error) => {
    console.error('Error en conexión individual:', error);
  });
});

pool.on('error', manejarErrorConexion);

// Función utilitaria para ejecutar queries
async function query(sql, params) {
  console.log('SQL:', sql);
  console.log('Parámetros:', params);
  const [rows] = await pool.execute(sql, params);
  return rows;
}


module.exports = {
  pool,
  inicializarBaseDatos,
  cerrarConexion,
  dbConfig,
  query
};
