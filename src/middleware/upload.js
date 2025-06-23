// src/middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crear directorios si no existen
const createDirectories = () => {
  const dirs = ['uploads/', 'uploads/perfiles/', 'uploads/galeria/', 'uploads/servicios/', 'uploads/productos/'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

createDirectories();

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    // Determinar el directorio según el tipo de upload
    let uploadDir = 'uploads/';
    
    if (req.body.tipo === 'perfil') {
      uploadDir = 'uploads/perfiles/';
    } else if (req.body.tipo === 'galeria') {
      uploadDir = 'uploads/galeria/';
    } else if (req.body.tipo === 'servicio') {
      uploadDir = 'uploads/servicios/';
    } else if (req.body.tipo === 'producto') {
      uploadDir = 'uploads/productos/';
    }
    
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    // Generar nombre único para el archivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    
    // Crear nombre de archivo seguro
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    cb(null, `${safeName}-${uniqueSuffix}${ext}`);
  }
});

// Filtro de archivos
const fileFilter = (req, file, cb) => {
  // Tipos de archivo permitidos
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido. Tipos permitidos: ${allowedMimeTypes.join(', ')}`), false);
  }
};

// Configuración de límites
const limits = {
  fileSize: 10 * 1024 * 1024, // 10MB máximo
  files: 5 // Máximo 5 archivos por request
};

// Configuración principal de multer
const upload = multer({
  storage: storage,
  limits: limits,
  fileFilter: fileFilter
});

// Middleware para manejo de errores de multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'El archivo es demasiado grande. Tamaño máximo: 10MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Demasiados archivos. Máximo 5 archivos por request'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Campo de archivo inesperado'
      });
    }
  }
  
  if (error.message.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Error al procesar el archivo'
  });
};

// Configuraciones específicas para diferentes tipos de upload
const uploadProfile = upload.single('foto_perfil');
const uploadGallery = upload.array('imagenes', 5);
const uploadService = upload.single('imagen_servicio');
const uploadProduct = upload.single('imagen_producto');
const uploadMultiple = upload.array('archivos', 5);

// Middleware para validar dimensiones de imagen (solo para imágenes)
const validateImageDimensions = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }

  const files = req.file ? [req.file] : req.files;
  
  files.forEach(file => {
    if (file.mimetype.startsWith('image/')) {
      // Aquí podrías agregar validación de dimensiones si es necesario
      // Por ejemplo, verificar que las imágenes de perfil sean cuadradas
      if (req.body.tipo === 'perfil') {
        // Validación específica para fotos de perfil
        console.log('Validando foto de perfil:', file.filename);
      }
    }
  });

  next();
};

// Función para eliminar archivos
const deleteFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Archivo eliminado: ${filePath}`);
  }
};

// Función para obtener la URL pública del archivo
const getFileUrl = (filename, tipo = 'general') => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/uploads/${tipo}/${filename}`;
};

module.exports = {
  upload,
  uploadProfile,
  uploadGallery,
  uploadService,
  uploadProduct,
  uploadMultiple,
  handleUploadError,
  validateImageDimensions,
  deleteFile,
  getFileUrl
};