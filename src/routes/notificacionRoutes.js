const express = require('express');
const { body, query } = require('express-validator');
const notificacionController = require('../controllers/notificacionController');
const { protect, authorize } = require('../middleware/auth');
const handleValidation = require('../middleware/handleValidation');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(protect);

// --- Rutas para Administradores, Dueños y Empleados ---
router.route('/')
    .post([
        authorize('administrador', 'dueño', 'empleado'),
        body('usuario_id').isInt({ min: 1 }).withMessage('ID de usuario debe ser un número positivo'),
        body('titulo').isString().notEmpty().withMessage('Título es requerido'),
        body('mensaje').isString().notEmpty().withMessage('Mensaje es requerido'),
        body('tipo').isIn(['sistema', 'cita', 'promocion', 'recordatorio', 'otro']).withMessage('Tipo debe ser válido'),
        body('leida').optional().isBoolean().withMessage('Leída debe ser true o false'),
        body('fecha_envio').optional().isISO8601().withMessage('Fecha de envío debe ser válida'),
        body('datos_adicionales').optional().isString()
    ], handleValidation, notificacionController.createNotificacion)
    .get([
        authorize('administrador', 'dueño', 'empleado'),
        query('usuario_id').optional().isInt({ min: 1 }).withMessage('ID de usuario debe ser un número positivo'),
        query('tipo').optional().isIn(['sistema', 'cita', 'promocion', 'recordatorio', 'otro']).withMessage('Tipo debe ser válido'),
        query('leida').optional().isBoolean().withMessage('Leída debe ser true o false'),
        query('fecha_inicio').optional().isISO8601().withMessage('Fecha de inicio debe ser válida'),
        query('fecha_fin').optional().isISO8601().withMessage('Fecha de fin debe ser válida'),
        query('ordenar_por').optional().isIn(['fecha_envio', 'leida', 'tipo', 'usuario_id']).withMessage('Ordenar por debe ser válido'),
        query('orden').optional().isIn(['ASC', 'DESC']).withMessage('Orden debe ser ASC o DESC')
    ], handleValidation, notificacionController.getAllNotificaciones);

router.route('/:id')
    .get([
        authorize('administrador', 'dueño', 'empleado'),
        body('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo')
    ], handleValidation, notificacionController.getNotificacionById)
    .put([
        authorize('administrador', 'dueño', 'empleado'),
        body('titulo').optional().isString().notEmpty().withMessage('Título no puede estar vacío'),
        body('mensaje').optional().isString().notEmpty().withMessage('Mensaje no puede estar vacío'),
        body('tipo').optional().isIn(['sistema', 'cita', 'promocion', 'recordatorio', 'otro']).withMessage('Tipo debe ser válido'),
        body('leida').optional().isBoolean().withMessage('Leída debe ser true o false'),
        body('fecha_envio').optional().isISO8601().withMessage('Fecha de envío debe ser válida'),
        body('datos_adicionales').optional().isString()
    ], handleValidation, notificacionController.updateNotificacion)
    .delete([
        authorize('administrador', 'dueño'),
        body('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo')
    ], handleValidation, notificacionController.deleteNotificacion);

// --- Rutas específicas ---
router.get('/usuario/:usuario_id', [
    authorize('administrador', 'dueño', 'empleado'),
    query('leida').optional().isBoolean().withMessage('Leída debe ser true o false'),
    query('tipo').optional().isIn(['sistema', 'cita', 'promocion', 'recordatorio', 'otro']).withMessage('Tipo debe ser válido'),
    query('ordenar_por').optional().isIn(['fecha_envio', 'leida', 'tipo']).withMessage('Ordenar por debe ser válido'),
    query('orden').optional().isIn(['ASC', 'DESC']).withMessage('Orden debe ser ASC o DESC')
], handleValidation, notificacionController.getNotificacionesPorUsuario);

router.get('/tipo/:tipo', [
    authorize('administrador', 'dueño', 'empleado'),
    query('usuario_id').optional().isInt({ min: 1 }).withMessage('ID de usuario debe ser un número positivo'),
    query('leida').optional().isBoolean().withMessage('Leída debe ser true o false'),
    query('fecha_inicio').optional().isISO8601().withMessage('Fecha de inicio debe ser válida'),
    query('fecha_fin').optional().isISO8601().withMessage('Fecha de fin debe ser válida')
], handleValidation, notificacionController.getNotificacionesPorTipo);

router.get('/no-leidas', [
    authorize('administrador', 'dueño', 'empleado'),
    query('usuario_id').isInt({ min: 1 }).withMessage('ID de usuario debe ser un número positivo'),
    query('tipo').optional().isIn(['sistema', 'cita', 'promocion', 'recordatorio', 'otro']).withMessage('Tipo debe ser válido')
], handleValidation, notificacionController.getNotificacionesNoLeidas);

router.patch('/:id/leer', [
    authorize('administrador', 'dueño', 'empleado')
], notificacionController.marcarComoLeida);

router.patch('/leer-todas', [
    authorize('administrador', 'dueño', 'empleado'),
    body('usuario_id').isInt({ min: 1 }).withMessage('ID de usuario debe ser un número positivo')
], handleValidation, notificacionController.marcarTodasComoLeidas);

router.get('/fecha/:fecha', [
    authorize('administrador', 'dueño', 'empleado'),
    query('usuario_id').optional().isInt({ min: 1 }).withMessage('ID de usuario debe ser un número positivo'),
    query('tipo').optional().isIn(['sistema', 'cita', 'promocion', 'recordatorio', 'otro']).withMessage('Tipo debe ser válido')
], handleValidation, notificacionController.getNotificacionesPorFecha);

module.exports = router; 