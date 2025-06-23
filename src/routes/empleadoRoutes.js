const express = require('express');
const router = express.Router();

const {
    createEmpleado,
    getAllEmpleados,
    getEmpleadoById,
    updateEmpleado,
    deleteEmpleado,
    manageEspecialidades,
    manageServicios,
    upsertHorarioEmpleado,
    addAusenciaEmpleado,
    getAusenciasEmpleado,
    updateAusenciaEmpleado,
    deleteAusenciaEmpleado
} = require('../controllers/empleadoController');

const { protect, authorize } = require('../middleware/auth');

// Todas las rutas de empleados estarán protegidas y requerirán rol de 'administrador' o 'dueño'.
// Los roles se basan en el ID de la tabla `roles`: 1=administrador, 4=dueño
router.use(protect);
router.use(authorize('administrador', 'dueño'));

// --- Rutas CRUD principales para Empleados ---
router.route('/')
    .post(createEmpleado)
    .get(getAllEmpleados);

router.route('/:id')
    .get(getEmpleadoById)
    .put(updateEmpleado)
    .delete(deleteEmpleado);

// --- Rutas para gestión de relaciones ---
router.route('/:id/especialidades')
    .post(manageEspecialidades);

router.route('/:id/servicios')
    .post(manageServicios);

router.route('/:id/horarios')
    .post(upsertHorarioEmpleado);

// --- Rutas para gestión de Ausencias ---
router.route('/:id/ausencias')
    .post(addAusenciaEmpleado)
    .get(getAusenciasEmpleado);

router.route('/:id/ausencias/:ausenciaId')
    .put(updateAusenciaEmpleado)
    .delete(deleteAusenciaEmpleado);

module.exports = router;
