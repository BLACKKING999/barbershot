const express = require('express');
const router = express.Router();
const servicioController = require('../controllers/servicioController');
const { protect, authorize } = require('../middleware/auth');

// Rutas públicas
router.get('/', servicioController.obtenerServicios);
router.get('/destacados', servicioController.obtenerServiciosDestacados);
router.get('/buscar', servicioController.buscarServicios);
router.get('/categoria/:categoria_id', servicioController.obtenerServiciosPorCategoria);
router.get('/:id', servicioController.obtenerServicioPorId);

// Rutas protegidas (solo admin o dueño)
router.post('/', protect, authorize('administrador', 'dueño'), servicioController.crearServicio);
router.put('/:id', protect, authorize('administrador', 'dueño'), servicioController.actualizarServicio);
router.delete('/:id', protect, authorize('administrador', 'dueño'), servicioController.eliminarServicio);

module.exports = router; 