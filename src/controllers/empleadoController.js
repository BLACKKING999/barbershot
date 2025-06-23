const { Usuario, Empleado, Cliente, EmpleadoEspecialidad, EmpleadoServicio, HorarioEmpleado, AusenciaEmpleado, Especialidad, Servicio, Rol } = require('../models');
const asyncHandler = require('../middleware/asyncHandler');
// const { errorHandler } = require('./middleware/errorHandler');
// Local ErrorResponse class to replace missing '../utils/errorResponse'
class ErrorResponse extends Error {
    constructor(message, statusCode, errors = null) {
        super(message);
        this.statusCode = statusCode;
        if (errors) this.errors = errors;
        Error.captureStackTrace(this, this.constructor);
    }
}
// Remover esta línea: const { Op } = require('sequelize');


// @desc    Obtener el perfil completo de un empleado
const getEmpleadoCompleto = async (empleadoId) => {
    return await Empleado.findByPk(empleadoId, {
        include: [
            {
                model: Usuario,
                as: 'usuario',
                attributes: { exclude: ['password'] }
            },
            {
                model: Especialidad,
                as: 'especialidades',
                through: { attributes: [] } 
            },
            {
                model: Servicio,
                as: 'servicios',
                through: { attributes: [] }
            },
            {
                model: HorarioEmpleado,
                as: 'horarios'
            },
            {
                model: AusenciaEmpleado,
                as: 'ausencias'
            }
        ]
    });
};

// @desc    Crear un nuevo empleado a partir de un usuario existente
// @route   POST /api/empleados
// @access  Private (Admin, Dueño)
exports.createEmpleado = asyncHandler(async (req, res, next) => {
    const { 
        usuario_id, // ID del usuario existente a promover
        titulo, 
        biografia, 
        fecha_contratacion, 
        especialidades, // array de IDs de especialidad
        servicios,      // array de IDs de servicio
        horarios        // array de objetos de horario { dia_semana, hora_inicio, hora_fin }
    } = req.body;

    const ROL_EMPLEADO_ID = 2; // Rol de Empleado

    if (!usuario_id) {
        return next(new ErrorResponse('Se requiere el ID del usuario a promover.', 400));
    }

    const t = await sequelize.transaction();

    try {
        // 1. Validar que el usuario exista
        const usuario = await Usuario.findByPk(usuario_id, { transaction: t });
        if (!usuario) {
            await t.rollback();
            return next(new ErrorResponse(`Usuario no encontrado con el ID ${usuario_id}`, 404));
        }

        // 2. Verificar que no sea ya un empleado
        if (usuario.rol_id === ROL_EMPLEADO_ID || await Empleado.findOne({ where: { usuario_id }, transaction: t })) {
             await t.rollback();
             return next(new ErrorResponse('Este usuario ya tiene un perfil de empleado.', 400));
        }

        // 3. Promover al usuario: Actualizar rol y eliminar perfil de cliente si existe
        await usuario.update({ rol_id: ROL_EMPLEADO_ID }, { transaction: t });
        await Cliente.destroy({ where: { usuario_id: usuario.id }, transaction: t });

        // 4. Crear el perfil de Empleado
        const empleado = await Empleado.create({
            usuario_id: usuario.id,
            titulo,
            biografia,
            fecha_contratacion: fecha_contratacion || new Date(),
            activo: true
        }, { transaction: t });

        // 5. Asignar Especialidades
        if (especialidades && especialidades.length > 0) {
            const especialidadesData = especialidades.map(id => ({ empleado_id: empleado.id, especialidad_id: id }));
            await EmpleadoEspecialidad.bulkCreate(especialidadesData, { transaction: t });
        }

        // 6. Asignar Servicios
        if (servicios && servicios.length > 0) {
            const serviciosData = servicios.map(id => ({ empleado_id: empleado.id, servicio_id: id }));
            await EmpleadoServicio.bulkCreate(serviciosData, { transaction: t });
        }

        // 7. Asignar Horarios
        if (horarios && horarios.length > 0) {
            const horariosData = horarios.map(h => ({ ...h, empleado_id: empleado.id }));
            await HorarioEmpleado.bulkCreate(horariosData, { transaction: t });
        }

        await t.commit();

        const empleadoCompleto = await getEmpleadoCompleto(empleado.id);

        res.status(201).json({
            success: true,
            mensaje: 'Usuario promovido a empleado exitosamente.',
            data: empleadoCompleto
        });

    } catch (error) {
        await t.rollback();
        next(new ErrorResponse('No se pudo crear el perfil de empleado. Por favor, revise los datos.', 500, error.errors));
    }
});

// @desc    Obtener todos los empleados
// @route   GET /api/empleados
// @access  Private (Admin, Dueño)
exports.getAllEmpleados = asyncHandler(async (req, res, next) => {
    const empleados = await Empleado.findAll({
        include: [{
            model: Usuario,
            as: 'usuario',
            attributes: ['nombre', 'apellido', 'email', 'foto_perfil']
        }],
        where: { activo: true }
    });

    res.status(200).json({
        success: true,
        count: empleados.length,
        data: empleados
    });
});

// @desc    Obtener un empleado por ID
// @route   GET /api/empleados/:id
// @access  Private (Admin, Dueño)
exports.getEmpleadoById = asyncHandler(async (req, res, next) => {
    const empleado = await getEmpleadoCompleto(req.params.id);

    if (!empleado) {
        return next(new ErrorResponse(`Empleado no encontrado con el id ${req.params.id}`, 404));
    }

    res.status(200).json({
        success: true,
        data: empleado
    });
});

// @desc    Actualizar un empleado
// @route   PUT /api/empleados/:id
// @access  Private (Admin, Dueño)
exports.updateEmpleado = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { email, nombre, apellido, telefono, foto_perfil, titulo, biografia, activo } = req.body;

    const empleado = await Empleado.findByPk(id);
    if (!empleado) {
        return next(new ErrorResponse(`Empleado no encontrado con el id ${id}`, 404));
    }

    const t = await sequelize.transaction();

    try {
        // Actualizar datos del empleado
        await empleado.update({ titulo, biografia, activo }, { transaction: t });

        // Actualizar datos del usuario asociado
        const usuario = await Usuario.findByPk(empleado.usuario_id);
        if (usuario) {
            await usuario.update({ email, nombre, apellido, telefono, foto_perfil }, { transaction: t });
        }
        
        await t.commit();
        
        const empleadoActualizado = await getEmpleadoCompleto(id);

        res.status(200).json({
            success: true,
            data: empleadoActualizado
        });
    } catch (error) {
        await t.rollback();
        next(new ErrorResponse('No se pudo actualizar el empleado.', 500, error.errors));
    }
});

// @desc    Eliminar un empleado (desactivar)
// @route   DELETE /api/empleados/:id
// @access  Private (Admin, Dueño)
exports.deleteEmpleado = asyncHandler(async (req, res, next) => {
    const empleado = await Empleado.findByPk(req.params.id);

    if (!empleado) {
        return next(new ErrorResponse(`Empleado no encontrado con el id ${req.params.id}`, 404));
    }
    
    // Soft delete: solo se desactiva el empleado y el usuario
    const t = await sequelize.transaction();
    try {
        await empleado.update({ activo: false }, { transaction: t });
        const usuario = await Usuario.findByPk(empleado.usuario_id);
        if (usuario) {
            await usuario.update({ activo: false }, { transaction: t });
        }
        await t.commit();

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        await t.rollback();
        next(new ErrorResponse('No se pudo eliminar el empleado.', 500));
    }
});


// --- Especialidades ---
// @desc    Asignar/Actualizar especialidades a un empleado
// @route   POST /api/empleados/:id/especialidades
// @access  Private (Admin, Dueño)
exports.manageEspecialidades = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { especialidades } = req.body; // Array de IDs

    const empleado = await Empleado.findByPk(id);
    if (!empleado) {
        return next(new ErrorResponse(`Empleado no encontrado con id ${id}`, 404));
    }

    if (!Array.isArray(especialidades)) {
        return next(new ErrorResponse('El campo especialidades debe ser un array de IDs.', 400));
    }

    const especialidadesData = especialidades.map(espId => ({ empleado_id: id, especialidad_id: espId }));

    const t = await sequelize.transaction();
    try {
        // Limpiar especialidades anteriores
        await EmpleadoEspecialidad.destroy({ where: { empleado_id: id }, transaction: t });
        // Insertar las nuevas
        await EmpleadoEspecialidad.bulkCreate(especialidadesData, { transaction: t });
        
        await t.commit();
        
        const empleadoActualizado = await getEmpleadoCompleto(id);
        res.status(200).json({ success: true, data: empleadoActualizado.especialidades });
    } catch (error) {
        await t.rollback();
        next(new ErrorResponse('No se pudieron actualizar las especialidades.', 500));
    }
});


// --- Servicios ---
// @desc    Asignar/Actualizar servicios a un empleado
// @route   POST /api/empleados/:id/servicios
// @access  Private (Admin, Dueño)
exports.manageServicios = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { servicios } = req.body; // Array de IDs

    const empleado = await Empleado.findByPk(id);
    if (!empleado) {
        return next(new ErrorResponse(`Empleado no encontrado con id ${id}`, 404));
    }
    
    if (!Array.isArray(servicios)) {
        return next(new ErrorResponse('El campo servicios debe ser un array de IDs.', 400));
    }

    const serviciosData = servicios.map(srvId => ({ empleado_id: id, servicio_id: srvId }));

    const t = await sequelize.transaction();
    try {
        // Limpiar servicios anteriores
        await EmpleadoServicio.destroy({ where: { empleado_id: id }, transaction: t });
        // Insertar los nuevos
        await EmpleadoServicio.bulkCreate(serviciosData, { transaction: t });
        
        await t.commit();

        const empleadoActualizado = await getEmpleadoCompleto(id);
        res.status(200).json({ success: true, data: empleadoActualizado.servicios });
    } catch (error) {
        await t.rollback();
        next(new ErrorResponse('No se pudieron actualizar los servicios.', 500));
    }
});


// --- Horarios ---
// @desc    Crear o actualizar el horario de un empleado
// @route   POST /api/empleados/:id/horarios
// @access  Private (Admin, Dueño)
exports.upsertHorarioEmpleado = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { horarios } = req.body; // Array de objetos { dia_semana, hora_inicio, hora_fin, es_descanso }

    if (!await Empleado.findByPk(id)) {
        return next(new ErrorResponse(`Empleado no encontrado con id ${id}`, 404));
    }
    
    if (!Array.isArray(horarios)) {
        return next(new ErrorResponse('El campo horarios debe ser un array.', 400));
    }

    const horariosData = horarios.map(h => ({ ...h, empleado_id: id }));

    const t = await sequelize.transaction();
    try {
        await HorarioEmpleado.destroy({ where: { empleado_id: id }, transaction: t });
        await HorarioEmpleado.bulkCreate(horariosData, { transaction: t });
        await t.commit();

        const data = await HorarioEmpleado.findAll({ where: { empleado_id: id }});
        res.status(200).json({ success: true, data });
    } catch (error) {
        await t.rollback();
        next(new ErrorResponse('No se pudo actualizar el horario.', 500, error.errors));
    }
});


// --- Ausencias ---
// @desc    Registrar una nueva ausencia para un empleado
// @route   POST /api/empleados/:id/ausencias
// @access  Private (Admin, Dueño)
exports.addAusenciaEmpleado = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    req.body.empleado_id = id;

    if (!await Empleado.findByPk(id)) {
        return next(new ErrorResponse(`Empleado no encontrado con id ${id}`, 404));
    }

    const ausencia = await AusenciaEmpleado.create(req.body);

    res.status(201).json({
        success: true,
        data: ausencia
    });
});

// @desc    Obtener todas las ausencias de un empleado
// @route   GET /api/empleados/:id/ausencias
// @access  Private (Admin, Dueño)
exports.getAusenciasEmpleado = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    
    if (!await Empleado.findByPk(id)) {
        return next(new ErrorResponse(`Empleado no encontrado con id ${id}`, 404));
    }

    const ausencias = await AusenciaEmpleado.findAll({ where: { empleado_id: id } });
    
    res.status(200).json({
        success: true,
        count: ausencias.length,
        data: ausencias
    });
});

// @desc    Actualizar una ausencia
// @route   PUT /api/empleados/:id/ausencias/:ausenciaId
// @access  Private (Admin, Dueño)
exports.updateAusenciaEmpleado = asyncHandler(async (req, res, next) => {
    let ausencia = await AusenciaEmpleado.findByPk(req.params.ausenciaId);
    if (!ausencia) {
        return next(new ErrorResponse(`Ausencia no encontrada con id ${req.params.ausenciaId}`, 404));
    }

    ausencia = await ausencia.update(req.body);

    res.status(200).json({
        success: true,
        data: ausencia
    });
});

// @desc    Eliminar una ausencia
// @route   DELETE /api/empleados/:id/ausencias/:ausenciaId
// @access  Private (Admin, Dueño)
exports.deleteAusenciaEmpleado = asyncHandler(async (req, res, next) => {
    const ausencia = await AusenciaEmpleado.findByPk(req.params.ausenciaId);
    if (!ausencia) {
        return next(new ErrorResponse(`Ausencia no encontrada con id ${req.params.ausenciaId}`, 404));
    }
    
    await ausencia.destroy();

    res.status(200).json({ success: true, data: {} });
});
