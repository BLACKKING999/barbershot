const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const handleValidation = require('../middleware/handleValidation');

const router = express.Router();

// --- Rutas Públicas ---

// Login con Google
router.post('/login/google', [
    body('idToken').notEmpty().withMessage('El idToken de Google es requerido.'),
], handleValidation, authController.loginGoogle);

// --- Rutas Privadas (requieren token de acceso) ---
router.use(protect);

// Cerrar Sesión
router.post('/logout', authController.cerrarSesion);

// Gestionar Perfil
router.route('/profile')
    .get(authController.obtenerPerfil)
    .put([
        body('nombre').optional().isString({ min: 2, max: 100 }).trim(),
        body('apellido').optional().isString({ min: 2, max: 100 }).trim(),
        body('telefono').optional().isString(),
        body('foto_perfil').optional().isURL(),
        body('notificacion_correo').optional().isBoolean(),
        body('notificacion_push').optional().isBoolean(),
        body('notificacion_sms').optional().isBoolean(),
        body('recordatorio_horas_antes').optional().isInt({ min: 1, max: 168 })
    ], handleValidation, authController.actualizarPerfil);

// Verificar Token
router.get('/verify', authController.verificarAutenticacion);

// Verificar estado del token (pública)
router.get('/verify-token', authController.verifyToken);

// --- Rutas de Administrador/Dueño ---
router.get('/stats', authorize('administrador', 'dueño'), authController.obtenerEstadisticas);


module.exports = router;