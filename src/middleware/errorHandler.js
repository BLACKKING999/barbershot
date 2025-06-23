/**
 * Middleware para manejo centralizado de errores
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Errores de validación de Joi
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: err.details.map(detail => detail.message)
    });
  }

  // Errores de MySQL
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'El registro ya existe en la base de datos'
    });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      message: 'Referencia inválida en la base de datos'
    });
  }

  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(400).json({
      success: false,
      message: 'No se puede eliminar el registro porque está siendo utilizado'
    });
  }

  // Errores de autenticación
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token de autenticación inválido'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token de autenticación expirado'
    });
  }

  // Errores de permisos
  if (err.name === 'PermissionError') {
    return res.status(403).json({
      success: false,
      message: err.message || 'No tienes permisos para realizar esta acción'
    });
  }

  // Errores de validación de negocio
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  // Errores de recursos no encontrados
  if (err.name === 'NotFoundError') {
    return res.status(404).json({
      success: false,
      message: err.message || 'Recurso no encontrado'
    });
  }

  // Errores de conflicto (por ejemplo, horario no disponible)
  if (err.name === 'ConflictError') {
    return res.status(409).json({
      success: false,
      message: err.message
    });
  }

  // Error por defecto
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Error interno del servidor' 
      : err.message
  });
};

/**
 * Middleware para manejar rutas no encontradas
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`
  });
};

/**
 * Clases de error personalizadas
 */
class PermissionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PermissionError';
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
  }
}

/**
 * Middleware para logging de requests
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });

  next();
};

/**
 * Middleware para validar que el usuario esté activo
 */
const validateActiveUser = (req, res, next) => {
  if (req.user && !req.user.activo) {
    return res.status(403).json({
      success: false,
      message: 'Tu cuenta ha sido desactivada. Contacta al administrador.'
    });
  }
  next();
};

/**
 * Middleware para rate limiting básico
 */
const rateLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Limpiar requests antiguos
    if (requests.has(ip)) {
      requests.set(ip, requests.get(ip).filter(time => time > windowStart));
    } else {
      requests.set(ip, []);
    }

    const userRequests = requests.get(ip);

    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
      });
    }

    userRequests.push(now);
    next();
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  requestLogger,
  validateActiveUser,
  rateLimiter,
  PermissionError,
  ValidationError,
  NotFoundError,
  ConflictError
}; 