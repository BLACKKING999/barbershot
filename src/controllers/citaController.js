const Cita = require('../models/Cita');
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

// @desc    Crear una nueva cita
// @route   POST /api/citas
// @access  Private (Admin, Dueño, Empleado)
exports.createCita = asyncHandler(async (req, res, next) => {
    try {
        const cita = await Cita.crear(req.body);
        res.status(201).json({
            success: true,
            mensaje: 'Cita creada exitosamente.',
            data: cita
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 400));
    }
});

// @desc    Obtener todas las citas
// @route   GET /api/citas
// @access  Private (Admin, Dueño, Empleado)
exports.getAllCitas = asyncHandler(async (req, res, next) => {
    try {
        const citas = await Cita.obtenerTodas(req.query);
        res.status(200).json({
            success: true,
            count: citas.length,
            data: citas
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
});

// @desc    Obtener una cita por ID
// @route   GET /api/citas/:id
// @access  Private (Admin, Dueño, Empleado)
exports.getCitaById = asyncHandler(async (req, res, next) => {
    try {
        const cita = await Cita.obtenerPorId(req.params.id);

        if (!cita) {
            return next(new ErrorResponse(`Cita no encontrada con el id ${req.params.id}`, 404));
        }

        res.status(200).json({
            success: true,
            data: cita
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
});

// @desc    Actualizar una cita
// @route   PUT /api/citas/:id
// @access  Private (Admin, Dueño, Empleado)
exports.updateCita = asyncHandler(async (req, res, next) => {
    try {
        const cita = await Cita.actualizar(req.params.id, req.body);

        res.status(200).json({
            success: true,
            mensaje: 'Cita actualizada exitosamente',
            data: cita
        });
    } catch (error) {
        if (error.message.includes('no encontrada')) {
            next(new ErrorResponse(error.message, 404));
        } else {
            next(new ErrorResponse(error.message, 400));
        }
    }
});

// @desc    Cambiar estado de una cita
// @route   PATCH /api/citas/:id/estado
// @access  Private (Admin, Dueño, Empleado)
exports.cambiarEstadoCita = asyncHandler(async (req, res, next) => {
    try {
        const cita = await Cita.cambiarEstado(req.params.id, req.body);

        res.status(200).json({
            success: true,
            mensaje: 'Estado de cita actualizado exitosamente',
            data: cita
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 400));
    }
});

// @desc    Eliminar (cancelar) una cita
// @route   DELETE /api/citas/:id
// @access  Private (Admin, Dueño, Empleado)
exports.deleteCita = asyncHandler(async (req, res, next) => {
    try {
        const eliminado = await Cita.cancelar(req.params.id);

        if (!eliminado) {
            return next(new ErrorResponse(`Cita no encontrada con el id ${req.params.id}`, 404));
        }

        res.status(200).json({
            success: true,
            mensaje: 'Cita cancelada exitosamente'
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 400));
    }
});

// @desc    Obtener citas por fecha
// @route   GET /api/citas/fecha/:fecha
// @access  Private (Admin, Dueño, Empleado)
exports.getCitasPorFecha = asyncHandler(async (req, res, next) => {
    try {
        const { empleado_id } = req.query;
        const citas = await Cita.obtenerPorFecha(req.params.fecha, empleado_id);

        res.status(200).json({
            success: true,
            count: citas.length,
            data: citas
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
});

// @desc    Obtener disponibilidad de empleado
// @route   GET /api/citas/disponibilidad/:empleado_id
// @access  Private (Admin, Dueño, Empleado)
exports.getDisponibilidadEmpleado = asyncHandler(async (req, res, next) => {
    try {
        const { fecha } = req.query;
        const disponibilidad = await Cita.obtenerDisponibilidad(req.params.empleado_id, fecha);

        res.status(200).json({
            success: true,
            data: disponibilidad
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
});

// @desc    Obtener estadísticas de citas
// @route   GET /api/citas/stats
// @access  Private (Admin, Dueño)
exports.getStatsCitas = asyncHandler(async (req, res, next) => {
    try {
        const estadisticas = await Cita.obtenerEstadisticas(req.query);

        res.status(200).json({
            success: true,
            data: estadisticas
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
}); 