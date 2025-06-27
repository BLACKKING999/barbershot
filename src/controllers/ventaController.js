const VentaProducto = require('../models/VentaProducto');
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

// @desc    Crear una nueva venta
// @route   POST /api/ventas
// @access  Private (Admin, Dueño, Empleado)
exports.createVenta = asyncHandler(async (req, res, next) => {
    try {
        const venta = await VentaProducto.crear(req.body);
        res.status(201).json({
            success: true,
            mensaje: 'Venta creada exitosamente.',
            data: venta
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 400));
    }
});

// @desc    Obtener todas las ventas
// @route   GET /api/ventas
// @access  Private (Admin, Dueño, Empleado)
exports.getAllVentas = asyncHandler(async (req, res, next) => {
    try {
        const ventas = await VentaProducto.obtenerTodas(req.query);
        res.status(200).json({
            success: true,
            count: ventas.length,
            data: ventas
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
});

// @desc    Obtener una venta por ID
// @route   GET /api/ventas/:id
// @access  Private (Admin, Dueño, Empleado)
exports.getVentaById = asyncHandler(async (req, res, next) => {
    try {
        const venta = await VentaProducto.obtenerPorId(req.params.id);

        if (!venta) {
            return next(new ErrorResponse(`Venta no encontrada con el id ${req.params.id}`, 404));
        }

        res.status(200).json({
            success: true,
            data: venta
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
});

// @desc    Actualizar estado de pago de una venta
// @route   PATCH /api/ventas/:id/estado-pago
// @access  Private (Admin, Dueño, Empleado)
exports.updateEstadoPago = asyncHandler(async (req, res, next) => {
    try {
        const venta = await VentaProducto.actualizarEstadoPago(req.params.id, req.body);

        res.status(200).json({
            success: true,
            mensaje: 'Estado de pago actualizado exitosamente',
            data: venta
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 400));
    }
});

// @desc    Cancelar una venta
// @route   DELETE /api/ventas/:id
// @access  Private (Admin, Dueño)
exports.cancelarVenta = asyncHandler(async (req, res, next) => {
    try {
        const eliminado = await VentaProducto.cancelar(req.params.id);

        if (!eliminado) {
            return next(new ErrorResponse(`Venta no encontrada con el id ${req.params.id}`, 404));
        }

        res.status(200).json({
            success: true,
            mensaje: 'Venta cancelada exitosamente'
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 400));
    }
});

// @desc    Obtener ventas por cliente
// @route   GET /api/ventas/cliente/:cliente_id
// @access  Private (Admin, Dueño, Empleado)
exports.getVentasPorCliente = asyncHandler(async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const ventas = await VentaProducto.obtenerPorCliente(req.params.cliente_id, {
            page: parseInt(page),
            limit: parseInt(limit)
        });

        res.status(200).json({
            success: true,
            count: ventas.length,
            data: ventas
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
});

// @desc    Obtener estadísticas de ventas
// @route   GET /api/ventas/stats
// @access  Private (Admin, Dueño)
exports.getStatsVentas = asyncHandler(async (req, res, next) => {
    try {
        const estadisticas = await VentaProducto.obtenerEstadisticas(req.query);

        res.status(200).json({
            success: true,
            data: estadisticas
        });
    } catch (error) {
        next(new ErrorResponse(error.message, 500));
    }
}); 