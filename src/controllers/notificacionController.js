const Notificacion = require('../models/Notificacion');
const asyncHandler = require('../middleware/asyncHandler');

// Clase ErrorResponse local
class ErrorResponse extends Error {
    constructor(message, statusCode, errors = null) {
        super(message);
        this.statusCode = statusCode;
        if (errors) this.errors = errors;
        Error.captureStackTrace(this, this.constructor);
    }
}

// @desc    Crear una nueva notificación
// @route   POST /api/notificaciones
// @access  Private (Admin, Dueño, Empleado)
exports.createNotificacion = asyncHandler(async (req, res, next) => {
    try {
        const notificacion = await Notificacion.crear(req.body);
        res.status(201).json({
            success: true,
            mensaje: 'Notificación creada exitosamente.',
            data: notificacion
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 400));
    }
});

// @desc    Obtener todas las notificaciones
// @route   GET /api/notificaciones
// @access  Private (Admin, Dueño, Empleado)
exports.getAllNotificaciones = asyncHandler(async (req, res, next) => {
    try {
        const notificaciones = await Notificacion.obtenerTodas(req.query);
        res.status(200).json({
            success: true,
            count: notificaciones.length,
            data: notificaciones
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
});

// @desc    Obtener una notificación por ID
// @route   GET /api/notificaciones/:id
// @access  Private (Admin, Dueño, Empleado)
exports.getNotificacionById = asyncHandler(async (req, res, next) => {
    try {
        const notificacion = await Notificacion.obtenerPorId(req.params.id);
        if (!notificacion) {
            return next(new ErrorResponse(`Notificación no encontrada con el id ${req.params.id}`, 404));
        }
        res.status(200).json({
            success: true,
            data: notificacion
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
});

// @desc    Actualizar una notificación
// @route   PUT /api/notificaciones/:id
// @access  Private (Admin, Dueño, Empleado)
exports.updateNotificacion = asyncHandler(async (req, res, next) => {
    try {
        const notificacion = await Notificacion.actualizar(req.params.id, req.body);
        res.status(200).json({
            success: true,
            mensaje: 'Notificación actualizada exitosamente',
            data: notificacion
        });
    } catch (error) {
        if (error.message.includes('no encontrada')) {
            next(new ErrorResponse(error.message, 404));
        } else {
            next(new ErrorResponse(error.message, 400));
        }
    }
});

// @desc    Eliminar una notificación
// @route   DELETE /api/notificaciones/:id
// @access  Private (Admin, Dueño)
exports.deleteNotificacion = asyncHandler(async (req, res, next) => {
    try {
        const eliminado = await Notificacion.eliminar(req.params.id);
        if (!eliminado) {
            return next(new ErrorResponse(`Notificación no encontrada con el id ${req.params.id}`, 404));
        }
        res.status(200).json({
            success: true,
            mensaje: 'Notificación eliminada exitosamente'
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
});

// @desc    Obtener notificaciones por usuario
// @route   GET /api/notificaciones/usuario/:usuario_id
// @access  Private (Admin, Dueño, Empleado)
exports.getNotificacionesPorUsuario = asyncHandler(async (req, res, next) => {
    try {
        const notificaciones = await Notificacion.obtenerPorUsuario(req.params.usuario_id);
        res.status(200).json({
            success: true,
            count: notificaciones.length,
            data: notificaciones
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
});

// @desc    Obtener notificaciones por tipo
// @route   GET /api/notificaciones/tipo/:tipo
// @access  Private (Admin, Dueño, Empleado)
exports.getNotificacionesPorTipo = asyncHandler(async (req, res, next) => {
    try {
        const notificaciones = await Notificacion.obtenerPorTipo(req.params.tipo);
        res.status(200).json({
            success: true,
            count: notificaciones.length,
            data: notificaciones
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
});

// @desc    Obtener notificaciones no leídas
// @route   GET /api/notificaciones/no-leidas
// @access  Private (Admin, Dueño, Empleado)
exports.getNotificacionesNoLeidas = asyncHandler(async (req, res, next) => {
    try {
        const { usuario_id } = req.query;
        const notificaciones = await Notificacion.obtenerNoLeidas(usuario_id);
        res.status(200).json({
            success: true,
            count: notificaciones.length,
            data: notificaciones
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
});

// @desc    Marcar notificación como leída
// @route   PATCH /api/notificaciones/:id/leer
// @access  Private (Admin, Dueño, Empleado)
exports.marcarComoLeida = asyncHandler(async (req, res, next) => {
    try {
        const notificacion = await Notificacion.marcarComoLeida(req.params.id);
        res.status(200).json({
            success: true,
            mensaje: 'Notificación marcada como leída',
            data: notificacion
        });
    } catch (error) {
        if (error.message.includes('no encontrada')) {
            next(new ErrorResponse(error.message, 404));
        } else {
            next(new ErrorResponse(error.message, 400));
        }
    }
});

// @desc    Marcar todas las notificaciones como leídas
// @route   PATCH /api/notificaciones/leer-todas
// @access  Private (Admin, Dueño, Empleado)
exports.marcarTodasComoLeidas = asyncHandler(async (req, res, next) => {
    try {
        const { usuario_id } = req.body;
        const resultado = await Notificacion.marcarTodasComoLeidas(usuario_id);
        res.status(200).json({
            success: true,
            mensaje: 'Todas las notificaciones marcadas como leídas',
            data: resultado
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
});

// @desc    Obtener notificaciones por fecha
// @route   GET /api/notificaciones/fecha/:fecha
// @access  Private (Admin, Dueño, Empleado)
exports.getNotificacionesPorFecha = asyncHandler(async (req, res, next) => {
    try {
        const notificaciones = await Notificacion.obtenerPorFecha(req.params.fecha);
        res.status(200).json({
            success: true,
            count: notificaciones.length,
            data: notificaciones
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
}); 