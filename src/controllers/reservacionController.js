const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { query } = require('../config/database');
const Servicio = require('../models/Servicio');
const Empleado = require('../models/Empleado');
const Cita = require('../models/Cita');
const Cliente = require('../models/Cliente');
const HorarioEmpleado = require('../models/HorarioEmpleado');
const AusenciaEmpleado = require('../models/AusenciaEmpleado');
const EmpleadoServicio = require('../models/EmpleadoServicio');
const Pago = require('../models/Pago');
const Notificacion = require('../models/Notificacion');
const CorreoProgramado = require('../models/CorreoProgramado');
const EventoGoogleCalendar = require('../models/EventoGoogleCalendar');
const notificacionService = require('../services/notificacionService');

/**
 * @desc    Obtener servicios disponibles para reservación
 * @route   GET /api/reservacion/servicios
 * @access  Public
 */
exports.getServiciosDisponibles = asyncHandler(async (req, res, next) => {
  try {
    console.log('🔍 [reservacionController.getServiciosDisponibles] Iniciando...');
    
    const sql = `
      SELECT s.*, cs.nombre as categoria_nombre
      FROM servicios s
      LEFT JOIN categorias_servicios cs ON s.categoria_id = cs.id
      WHERE s.activo = 1
      ORDER BY cs.nombre, s.nombre
    `;
    
    const servicios = await query(sql);
    
    console.log('🔍 [reservacionController.getServiciosDisponibles] Servicios encontrados:', servicios.length);
    
    res.status(200).json({
      success: true,
      count: servicios.length,
      data: servicios
    });
  } catch (error) {
    console.error('❌ [reservacionController.getServiciosDisponibles] Error:', error);
    next(new ErrorResponse('Error al obtener servicios disponibles', 500));
  }
});

/**
 * @desc    Obtener empleados disponibles para servicios seleccionados
 * @route   GET /api/reservacion/empleados
 * @access  Public
 */
exports.getEmpleadosDisponibles = asyncHandler(async (req, res, next) => {
  try {
    const { servicios } = req.query;
    
    console.log('🔍 [reservacionController.getEmpleadosDisponibles] Parámetros:', { servicios });
    
    if (!servicios) {
      return next(new ErrorResponse('servicios es requerido', 400));
    }
    
    // Convertir servicios a array si viene como string
    const serviciosArray = Array.isArray(servicios) ? servicios : servicios.split(',');
    
    // Consulta corregida usando los nombres correctos de las tablas
    const sql = `
      SELECT DISTINCT 
        e.id,
        u.nombre,
        u.apellido,
        u.email,
        u.telefono,
        e.titulo,
        e.biografia,
        e.activo,
        GROUP_CONCAT(esp.nombre SEPARATOR ', ') as especialidades
      FROM empleados e
      INNER JOIN usuarios u ON e.usuario_id = u.id
      INNER JOIN empleado_servicio es ON e.id = es.empleado_id
      LEFT JOIN empleado_especialidad ee ON e.id = ee.empleado_id
      LEFT JOIN especialidades esp ON ee.especialidad_id = esp.id
      WHERE e.activo = 1 AND u.activo = 1
        AND es.servicio_id IN (${serviciosArray.map(() => '?').join(',')})
      GROUP BY e.id
      ORDER BY u.nombre, u.apellido
    `;
    
    const empleados = await query(sql, serviciosArray);
    
    console.log('🔍 [reservacionController.getEmpleadosDisponibles] Empleados encontrados:', empleados.length);
    
    res.status(200).json({
      success: true,
      count: empleados.length,
      empleados: empleados
    });
  } catch (error) {
    console.error('❌ [reservacionController.getEmpleadosDisponibles] Error:', error);
    return next(new ErrorResponse('Error al obtener empleados disponibles', 500));
  }
});

/**
 * @desc    Obtener horarios disponibles para un empleado en una fecha
 * @route   GET /api/reservacion/horarios
 * @access  Public
 */
exports.getHorariosDisponibles = asyncHandler(async (req, res, next) => {
  try {
    const { empleadoId, fecha, servicios } = req.query;
    
    console.log('🔍 [reservacionController.getHorariosDisponibles] Parámetros:', { empleadoId, fecha, servicios });
    
    if (!empleadoId || !fecha || !servicios) {
      return next(new ErrorResponse('empleadoId, fecha y servicios son requeridos', 400));
    }

    // Determinar el día de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado)
    const diaSemana = new Date(fecha).getDay();

    let horariosDisponibles = [];
    if (diaSemana === 0) {
      // Domingo
      horariosDisponibles = [
        '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
        '13:00', '13:30'
      ];
    } else {
      // Lunes a Sábado
      horariosDisponibles = [
        '09:15', '09:45', '10:15', '10:45', '11:15', '11:45', '12:15', '12:45',
        '14:15', '14:45', '15:15', '15:45', '16:15', '16:45', '17:15', '17:45', '18:15'
      ];
    }

    // Filtrar horarios ocupados (aquí puedes implementar la lógica real)
    const horariosOcupados = [];
    
    const horariosLibres = horariosDisponibles.filter(horario => 
      !horariosOcupados.includes(horario)
    );
    
    console.log('🔍 [reservacionController.getHorariosDisponibles] Horarios disponibles:', horariosLibres.length);
    
    res.status(200).json({
      success: true,
      count: horariosLibres.length,
      horarios: horariosLibres
    });
  } catch (error) {
    console.error('❌ [reservacionController.getHorariosDisponibles] Error:', error);
    next(new ErrorResponse('Error al obtener horarios disponibles', 500));
  }
});

/**
 * @desc    Procesar pago y crear cita
 * @route   POST /api/reservacion/procesar
 * @access  Private (Cliente)
 */
exports.procesarReservacion = asyncHandler(async (req, res, next) => {
  try {
    const { empleadoId, servicios, fecha, horario, total } = req.body;
    let clienteId = req.usuario.cliente_id;
    
    console.log('🔍 [reservacionController.procesarReservacion] Datos recibidos:', { empleadoId, servicios, fecha, horario, total });
    
    if (!empleadoId || !servicios || !fecha || !horario || !total) {
      return next(new ErrorResponse('Todos los campos son requeridos', 400));
    }
    
    // Si el usuario no es cliente, verificar si ya existe un registro de cliente
    if (!clienteId) {
      console.log('🔍 [reservacionController.procesarReservacion] Usuario no es cliente, verificando si existe registro...');
      
      try {
        // Primero verificar si ya existe un cliente para este usuario
        const clienteExistenteSql = 'SELECT id FROM clientes WHERE usuario_id = ?';
        const [clienteExistente] = await query(clienteExistenteSql, [req.usuario.id]);
        
        if (clienteExistente) {
          clienteId = clienteExistente.id;
          console.log('✅ [reservacionController.procesarReservacion] Cliente existente encontrado con ID:', clienteId);
        } else {
          // Solo crear si no existe
          console.log('🔍 [reservacionController.procesarReservacion] Creando nuevo registro de cliente...');
          const insertClienteSql = `
            INSERT INTO clientes (usuario_id, fecha_nacimiento, genero)
            VALUES (?, NULL, NULL)
          `;
          
          const result = await query(insertClienteSql, [req.usuario.id]);
          clienteId = result.insertId;
          console.log('✅ [reservacionController.procesarReservacion] Cliente creado con ID:', clienteId);
        }
      } catch (error) {
        console.error('❌ [reservacionController.procesarReservacion] Error verificando/creando cliente:', error);
        return next(new ErrorResponse('Error al verificar/crear registro de cliente', 500));
      }
    }
    
    // Calcular hora de fin basada en la duración de los servicios
    const duracionTotal = servicios.reduce((total, servicio) => {
      return total + (servicio.duracion || 30) * servicio.cantidad;
    }, 0);

    // Construir los valores datetime para inicio y fin
    const fechaHoraInicio = `${fecha} ${horario}:00`;
    const [hora, minuto] = horario.split(':');
    const inicioDate = new Date(`${fecha}T${horario}:00`);
    inicioDate.setMinutes(inicioDate.getMinutes() + duracionTotal);
    const horaFinStr = inicioDate.toTimeString().slice(0, 5);
    const fechaHoraFin = `${fecha} ${horaFinStr}:00`;

    // Crear la cita
    const insertCitaSql = `
      INSERT INTO citas (cliente_id, empleado_id, fecha_hora_inicio, fecha_hora_fin, estado_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, NOW(), NOW())
    `;
    
    const resultadoCita = await query(insertCitaSql, [clienteId, empleadoId, fechaHoraInicio, fechaHoraFin]);
    const citaId = resultadoCita.insertId;
    
    console.log('✅ [reservacionController.procesarReservacion] Cita creada con ID:', citaId);
    
    // Crear el registro de pago
    const insertPagoSql = `
      INSERT INTO pagos (cita_id, monto_total, metodo_pago_id, estado_pago_id, created_at, updated_at)
      VALUES (?, ?, 1, 1, NOW(), NOW())
    `;
    
    await query(insertPagoSql, [citaId, total]);
    
    console.log('✅ [reservacionController.procesarReservacion] Pago registrado para cita:', citaId);
    
    // Insertar detalles de la cita
    for (const servicio of servicios) {
      // Obtener el precio del servicio desde la base de datos
      const precioServicioSql = 'SELECT precio FROM servicios WHERE id = ?';
      const [servicioData] = await query(precioServicioSql, [servicio.id]);
      
      if (!servicioData) {
        console.error('❌ [reservacionController.procesarReservacion] Servicio no encontrado:', servicio.id);
        continue;
      }
      
      const precioUnitario = servicioData.precio;
      const subtotal = precioUnitario * servicio.cantidad;
      
      const insertDetalleSql = `
        INSERT INTO cita_servicio (cita_id, servicio_id, precio_aplicado, descuento, notas)
        VALUES (?, ?, ?, 0.00, NULL)
      `;
      
      await query(insertDetalleSql, [citaId, servicio.id, precioUnitario]);
      
      console.log(`✅ [reservacionController.procesarReservacion] Servicio ${servicio.id} agregado a cita ${citaId}`);
    }
    
    // Enviar notificaciones automáticamente
    try {
      console.log('🔔 [reservacionController.procesarReservacion] Enviando notificaciones...');
      await notificacionService.enviarNotificacionesConfirmacion(citaId);
      console.log('✅ [reservacionController.procesarReservacion] Notificaciones enviadas exitosamente');
    } catch (notifError) {
      console.error('⚠️ [reservacionController.procesarReservacion] Error enviando notificaciones:', notifError);
      // No fallar la reservación si las notificaciones fallan
    }
    
    res.status(200).json({
      success: true,
      message: 'Reservación procesada exitosamente',
      data: {
        citaId,
        fecha,
        horaInicio: horario,
        horaFin: horaFinStr,
        total
      }
    });
    
  } catch (error) {
    console.error('❌ [reservacionController.procesarReservacion] Error:', error);
    return next(new ErrorResponse('Error al procesar la reservación', 500));
  }
});

/**
 * @desc    Obtener citas del cliente
 * @route   GET /api/reservacion/mis-citas
 * @access  Private (Cliente)
 */
exports.getMisCitas = asyncHandler(async (req, res, next) => {
  try {
    let clienteId = req.usuario.cliente_id;
    
    // Si el usuario no es cliente, verificar si existe un registro
    if (!clienteId) {
      const clienteSql = 'SELECT id FROM clientes WHERE usuario_id = ?';
      const [cliente] = await query(clienteSql, [req.usuario.id]);
      
      if (!cliente) {
        // Si no existe cliente, devolver array vacío
        return res.status(200).json({
          success: true,
          count: 0,
          citas: []
        });
      }
      
      clienteId = cliente.id;
    }
    
    const sql = `
      SELECT c.*, 
             CONCAT(e.nombre, ' ', e.apellido) as empleado_nombre,
             ec.nombre as estado_nombre,
             ec.color as estado_color,
             GROUP_CONCAT(s.nombre SEPARATOR ', ') as servicios
      FROM citas c
      INNER JOIN empleados e ON c.empleado_id = e.id
      INNER JOIN estados_citas ec ON c.estado_id = ec.id
      LEFT JOIN cita_servicio cs ON c.id = cs.cita_id
      LEFT JOIN servicios s ON cs.servicio_id = s.id
      WHERE c.cliente_id = ?
      GROUP BY c.id
      ORDER BY c.fecha_hora_inicio DESC
    `;
    
    const citas = await query(sql, [clienteId]);
    
    res.status(200).json({
      success: true,
      count: citas.length,
      citas: citas.map(cita => ({
        ...cita,
        servicios: cita.servicios ? cita.servicios.split(', ') : []
      }))
    });
  } catch (error) {
    console.error('❌ [reservacionController.getMisCitas] Error:', error);
    next(new ErrorResponse('Error al obtener citas', 500));
  }
});

/**
 * @desc    Cancelar cita del cliente
 * @route   PUT /api/reservacion/cancelar/:id
 * @access  Private (Cliente)
 */
exports.cancelarCita = asyncHandler(async (req, res, next) => {
  try {
    const citaId = req.params.id;
    let clienteId = req.usuario.cliente_id;
    
    // Si el usuario no es cliente, verificar si existe un registro
    if (!clienteId) {
      const clienteSql = 'SELECT id FROM clientes WHERE usuario_id = ?';
      const [cliente] = await query(clienteSql, [req.usuario.id]);
      
      if (!cliente) {
        return next(new ErrorResponse('Usuario no es un cliente válido', 400));
      }
      
      clienteId = cliente.id;
    }
    
    // Verificar que la cita pertenece al cliente
    const citaSql = `
      SELECT * FROM citas 
      WHERE id = ? AND cliente_id = ?
    `;
    
    const [cita] = await query(citaSql, [citaId, clienteId]);
    
    if (!cita) {
      return next(new ErrorResponse('Cita no encontrada', 404));
    }
    
    // Actualizar estado a cancelada
    const actualizarSql = `
      UPDATE citas 
      SET estado_id = (SELECT id FROM estados_citas WHERE nombre = 'Cancelada'),
          updated_at = NOW()
      WHERE id = ?
    `;
    
    await query(actualizarSql, [citaId]);
    
    res.status(200).json({
      success: true,
      message: 'Cita cancelada exitosamente'
    });
  } catch (error) {
    console.error('❌ [reservacionController.cancelarCita] Error:', error);
    next(new ErrorResponse('Error al cancelar la cita', 500));
  }
});  
