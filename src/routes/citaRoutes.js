const express = require('express');
const { body, query } = require('express-validator');
const citaController = require('../controllers/citaController');
const { protect, authorize } = require('../middleware/auth');
const handleValidation = require('../middleware/handleValidation');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(protect);

// --- Rutas principales de citas ---
router.route('/')
    .post([
        authorize('administrador', 'dueño', 'empleado'),
        body('cliente_id').isInt({ min: 1 }).withMessage('ID de cliente requerido'),
        body('empleado_id').isInt({ min: 1 }).withMessage('ID de empleado requerido'),
        body('servicio_id').isInt({ min: 1 }).withMessage('ID de servicio requerido'),
        body('fecha_hora').isISO8601().withMessage('Fecha y hora válida requerida'),
        body('duracion').optional().isInt({ min: 15, max: 480 }).withMessage('Duración debe estar entre 15 y 480 minutos'),
        body('notas').optional().isString(),
        body('precio').optional().isFloat({ min: 0 }).withMessage('Precio debe ser un número positivo')
    ], handleValidation, citaController.createCita)
    .get([
        authorize('administrador', 'dueño', 'empleado'),
        query('page').optional().isInt({ min: 1 }).withMessage('Página debe ser un número positivo'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100'),
        query('fecha_inicio').optional().isISO8601().withMessage('Fecha de inicio debe ser válida'),
        query('fecha_fin').optional().isISO8601().withMessage('Fecha de fin debe ser válida'),
        query('estado_id').optional().isInt({ min: 1 }).withMessage('Estado debe ser un número positivo'),
        query('empleado_id').optional().isInt({ min: 1 }).withMessage('ID de empleado debe ser un número positivo'),
        query('cliente_id').optional().isInt({ min: 1 }).withMessage('ID de cliente debe ser un número positivo')
    ], handleValidation, citaController.getAllCitas);

router.route('/:id')
    .get([
        authorize('administrador', 'dueño', 'empleado'),
        body('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo')
    ], handleValidation, citaController.getCitaById)
    .put([
        authorize('administrador', 'dueño', 'empleado'),
        body('fecha_hora').optional().isISO8601().withMessage('Fecha y hora debe ser válida'),
        body('duracion').optional().isInt({ min: 15, max: 480 }).withMessage('Duración debe estar entre 15 y 480 minutos'),
        body('notas').optional().isString(),
        body('precio').optional().isFloat({ min: 0 }).withMessage('Precio debe ser un número positivo'),
        body('estado_cita_id').optional().isInt({ min: 1 }).withMessage('Estado debe ser un número positivo')
    ], handleValidation, citaController.updateCita)
    .delete([
        authorize('administrador', 'dueño', 'empleado'),
        body('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo')
    ], handleValidation, citaController.deleteCita);

// --- Ruta para cambiar estado de cita ---
router.patch('/:id/estado', [
    authorize('administrador', 'dueño', 'empleado'),
    body('estado_cita_id').isInt({ min: 1 }).withMessage('Estado requerido'),
    body('notas').optional().isString()
], handleValidation, citaController.cambiarEstadoCita);

// --- Rutas específicas ---
router.get('/fecha/:fecha', [
    authorize('administrador', 'dueño', 'empleado'),
    body('fecha').isISO8601().withMessage('Fecha debe ser válida'),
    query('empleado_id').optional().isInt({ min: 1 }).withMessage('ID de empleado debe ser un número positivo')
], handleValidation, citaController.getCitasPorFecha);

router.get('/disponibilidad/:empleado_id', [
    authorize('administrador', 'dueño', 'empleado'),
    query('fecha').isISO8601().withMessage('Fecha requerida')
], handleValidation, citaController.getDisponibilidadEmpleado);

// --- Ruta de estadísticas (solo admin y dueño) ---
router.get('/stats', [
    authorize('administrador', 'dueño'),
    query('fecha_inicio').optional().isISO8601().withMessage('Fecha de inicio debe ser válida'),
    query('fecha_fin').optional().isISO8601().withMessage('Fecha de fin debe ser válida')
], handleValidation, citaController.getStatsCitas);

module.exports = router; 