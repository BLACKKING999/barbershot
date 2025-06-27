// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

// Importar configuraciones
const { inicializarBaseDatos } = require('./config/database');
const { initializeFirebaseAdmin } = require('./config/firebaseAdmin');

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const empleadoRoutes = require('./routes/empleadoRoutes');
const servicioRoutes = require('./routes/servicioRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const citaRoutes = require('./routes/citaRoutes');
const productoRoutes = require('./routes/productoRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const ventaRoutes = require('./routes/ventaRoutes');
const especialidadRoutes = require('./routes/especialidadRoutes');

// Importar middleware
const { errorHandler } = require('./middleware/errorHandler');
const asyncHandler = require('./middleware/asyncHandler');

const app = express();

// Configuración de rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 requests por ventana
  message: {
    success: false,
    mensaje: 'Demasiadas solicitudes desde esta IP, inténtalo de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configuración de rate limiting para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // límite de 5 intentos de login por ventana
  message: {
    success: false,
    mensaje: 'Demasiados intentos de autenticación, inténtalo de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Configuración de CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Middleware de logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting general
app.use(limiter);

// Inicializar servicios
const inicializarServicios = async () => {
  try {
    // Inicializar base de datos
    await inicializarBaseDatos();
    
    // Inicializar Firebase Admin
    initializeFirebaseAdmin();
    
    console.log('✅ Todos los servicios inicializados correctamente');
  } catch (error) {
    console.error('❌ Error inicializando servicios:', error);
    process.exit(1);
  }
};

// Rutas de autenticación con rate limiting específico
app.use('/api/auth', authLimiter, authRoutes);

// Rutas principales de la aplicación
app.use('/api/empleados', empleadoRoutes);
app.use('/api/servicios', servicioRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/citas', citaRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/ventas', ventaRoutes);
app.use('/api/especialidades', especialidadRoutes);

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    mensaje: 'API de Barbería funcionando correctamente',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: '/api/auth',
      empleados: '/api/empleados',
      servicios: '/api/servicios',
      clientes: '/api/clientes',
      citas: '/api/citas',
      productos: '/api/productos',
      categorias: '/api/categorias',
      ventas: '/api/ventas',
      especialidades: '/api/especialidades'
    }
  });
});

// Ruta raíz
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    mensaje: 'Bienvenido a la API de Barbería',
    endpoints: {
      auth: '/api/auth',
      empleados: '/api/empleados',
      servicios: '/api/servicios',
      clientes: '/api/clientes',
      citas: '/api/citas',
      productos: '/api/productos',
      categorias: '/api/categorias',
      ventas: '/api/ventas',
      especialidades: '/api/especialidades',
      health: '/api/health'
    },
    documentation: 'Documentación disponible en /api/docs'
  });
});

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    mensaje: `Ruta ${req.originalUrl} no encontrada`,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Middleware de manejo de errores
app.use(errorHandler);

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Configuración del puerto
const PORT = process.env.PORT || 5000;

// Inicializar aplicación
const iniciarServidor = async () => {
  try {
    await inicializarServicios();
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
      console.log(`📱 API disponible en http://localhost:${PORT}`);
      console.log(`🔐 Endpoints de autenticación en http://localhost:${PORT}/api/auth`);
      console.log(`👥 Gestión de empleados en http://localhost:${PORT}/api/empleados`);
      console.log(`✂️ Gestión de servicios en http://localhost:${PORT}/api/servicios`);
      console.log(`👤 Gestión de clientes en http://localhost:${PORT}/api/clientes`);
      console.log(`📅 Gestión de citas en http://localhost:${PORT}/api/citas`);
      console.log(`🛍️ Gestión de productos en http://localhost:${PORT}/api/productos`);
      console.log(`📂 Gestión de categorías en http://localhost:${PORT}/api/categorias`);
      console.log(`💰 Gestión de ventas en http://localhost:${PORT}/api/ventas`);
      console.log(`🎯 Gestión de especialidades en http://localhost:${PORT}/api/especialidades`);
      console.log(`💚 Health check en http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Error iniciando el servidor:', error);
    process.exit(1);
  }
};

// Iniciar servidor si este archivo se ejecuta directamente
if (require.main === module) {
  iniciarServidor();
}

module.exports = app;
