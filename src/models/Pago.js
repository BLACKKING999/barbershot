const pool = require('../config/database');

/**
 * Modelo para la gestión de pagos
 * Maneja operaciones CRUD, búsquedas, filtros y estadísticas de pagos
 */
class Pago {
  /**
   * Crear un nuevo pago
   * @param {Object} pago - Datos del pago
   * @returns {Promise<Object>} Pago creado
   */
  static async crear(pago) {
    const {
      cita_id,
      monto_total,
      impuesto = 0.00,
      propina = 0.00,
      metodo_pago_id,
      estado_pago_id,
      referencia_pago,
      factura_emitida = 0,
      fecha_pago,
      notas
    } = pago;

    const query = `
      INSERT INTO pagos (
        cita_id, monto_total, impuesto, propina, metodo_pago_id,
        estado_pago_id, referencia_pago, factura_emitida, fecha_pago, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const [result] = await pool.execute(query, [
        cita_id, monto_total, impuesto, propina, metodo_pago_id,
        estado_pago_id, referencia_pago, factura_emitida, fecha_pago, notas
      ]);

      return this.obtenerPorId(result.insertId);
    } catch (error) {
      throw new Error(`Error al crear pago: ${error.message}`);
    }
  }

  /**
   * Obtener pago por ID
   * @param {number} id - ID del pago
   * @returns {Promise<Object|null>} Pago encontrado
   */
  static async obtenerPorId(id) {
    const query = `
      SELECT p.*, 
             mp.nombre as metodo_pago_nombre,
             ep.nombre as estado_pago_nombre,
             c.fecha_hora_inicio,
             c.fecha_hora_fin,
             CONCAT(u_cliente.nombre, ' ', u_cliente.apellido) as cliente_nombre,
             CONCAT(u_empleado.nombre, ' ', u_empleado.apellido) as empleado_nombre
      FROM pagos p
      JOIN metodos_pago mp ON p.metodo_pago_id = mp.id
      JOIN estados_pago ep ON p.estado_pago_id = ep.id
      JOIN citas c ON p.cita_id = c.id
      JOIN clientes cl ON c.cliente_id = cl.id
      JOIN usuarios u_cliente ON cl.usuario_id = u_cliente.id
      JOIN empleados e ON c.empleado_id = e.id
      JOIN usuarios u_empleado ON e.usuario_id = u_empleado.id
      WHERE p.id = ?
    `;

    try {
      const [rows] = await pool.execute(query, [id]);
      return rows[0] || null;
    } catch (error) {
      throw new Error(`Error al obtener pago: ${error.message}`);
    }
  }

  /**
   * Obtener todos los pagos con paginación
   * @param {Object} opciones - Opciones de paginación y filtros
   * @returns {Promise<Object>} Lista de pagos y metadatos
   */
  static async obtenerTodos(opciones = {}) {
    const {
      pagina = 1,
      limite = 10,
      estado_pago_id = null,
      metodo_pago_id = null,
      fecha_inicio = null,
      fecha_fin = null,
      orden = 'fecha_pago',
      direccion = 'DESC'
    } = opciones;

    let whereConditions = [];
    let params = [];

    if (estado_pago_id) {
      whereConditions.push('p.estado_pago_id = ?');
      params.push(estado_pago_id);
    }

    if (metodo_pago_id) {
      whereConditions.push('p.metodo_pago_id = ?');
      params.push(metodo_pago_id);
    }

    if (fecha_inicio) {
      whereConditions.push('p.fecha_pago >= ?');
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereConditions.push('p.fecha_pago <= ?');
      params.push(fecha_fin);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const offset = (pagina - 1) * limite;
    const query = `
      SELECT p.*, 
             mp.nombre as metodo_pago_nombre,
             ep.nombre as estado_pago_nombre,
             c.fecha_hora_inicio,
             CONCAT(u_cliente.nombre, ' ', u_cliente.apellido) as cliente_nombre,
             CONCAT(u_empleado.nombre, ' ', u_empleado.apellido) as empleado_nombre
      FROM pagos p
      JOIN metodos_pago mp ON p.metodo_pago_id = mp.id
      JOIN estados_pago ep ON p.estado_pago_id = ep.id
      JOIN citas c ON p.cita_id = c.id
      JOIN clientes cl ON c.cliente_id = cl.id
      JOIN usuarios u_cliente ON cl.usuario_id = u_cliente.id
      JOIN empleados e ON c.empleado_id = e.id
      JOIN usuarios u_empleado ON e.usuario_id = u_empleado.id
      ${whereClause}
      ORDER BY p.${orden} ${direccion}
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM pagos p
      ${whereClause}
    `;

    try {
      const [rows] = await pool.execute(query, [...params, limite, offset]);
      const [countResult] = await pool.execute(countQuery, params);

      return {
        pagos: rows,
        paginacion: {
          pagina,
          limite,
          total: countResult[0].total,
          totalPaginas: Math.ceil(countResult[0].total / limite)
        }
      };
    } catch (error) {
      throw new Error(`Error al obtener pagos: ${error.message}`);
    }
  }

  /**
   * Actualizar pago
   * @param {number} id - ID del pago
   * @param {Object} datos - Datos a actualizar
   * @returns {Promise<Object>} Pago actualizado
   */
  static async actualizar(id, datos) {
    const camposPermitidos = [
      'monto_total', 'impuesto', 'propina', 'metodo_pago_id',
      'estado_pago_id', 'referencia_pago', 'factura_emitida', 'fecha_pago', 'notas'
    ];

    const camposActualizar = [];
    const valores = [];

    camposPermitidos.forEach(campo => {
      if (datos[campo] !== undefined) {
        camposActualizar.push(`${campo} = ?`);
        valores.push(datos[campo]);
      }
    });

    if (camposActualizar.length === 0) {
      throw new Error('No hay campos válidos para actualizar');
    }

    valores.push(id);
    const query = `
      UPDATE pagos 
      SET ${camposActualizar.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    try {
      const [result] = await pool.execute(query, valores);
      
      if (result.affectedRows === 0) {
        throw new Error('Pago no encontrado');
      }

      return this.obtenerPorId(id);
    } catch (error) {
      throw new Error(`Error al actualizar pago: ${error.message}`);
    }
  }

  /**
   * Eliminar pago
   * @param {number} id - ID del pago
   * @returns {Promise<boolean>} Resultado de la operación
   */
  static async eliminar(id) {
    const query = 'DELETE FROM pagos WHERE id = ?';

    try {
      const [result] = await pool.execute(query, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error al eliminar pago: ${error.message}`);
    }
  }

  /**
   * Obtener pagos por cita
   * @param {number} cita_id - ID de la cita
   * @returns {Promise<Array>} Pagos de la cita
   */
  static async obtenerPorCita(cita_id) {
    const query = `
      SELECT p.*, 
             mp.nombre as metodo_pago_nombre,
             ep.nombre as estado_pago_nombre
      FROM pagos p
      JOIN metodos_pago mp ON p.metodo_pago_id = mp.id
      JOIN estados_pago ep ON p.estado_pago_id = ep.id
      WHERE p.cita_id = ?
      ORDER BY p.created_at DESC
    `;

    try {
      const [rows] = await pool.execute(query, [cita_id]);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener pagos por cita: ${error.message}`);
    }
  }

  /**
   * Obtener pagos por cliente
   * @param {number} cliente_id - ID del cliente
   * @param {Object} opciones - Opciones adicionales
   * @returns {Promise<Array>} Pagos del cliente
   */
  static async obtenerPorCliente(cliente_id, opciones = {}) {
    const { limite = 50, orden = 'fecha_pago DESC' } = opciones;

    const query = `
      SELECT p.*, 
             mp.nombre as metodo_pago_nombre,
             ep.nombre as estado_pago_nombre,
             c.fecha_hora_inicio,
             c.fecha_hora_fin
      FROM pagos p
      JOIN citas c ON p.cita_id = c.id
      JOIN metodos_pago mp ON p.metodo_pago_id = mp.id
      JOIN estados_pago ep ON p.estado_pago_id = ep.id
      WHERE c.cliente_id = ?
      ORDER BY p.${orden}
      LIMIT ?
    `;

    try {
      const [rows] = await pool.execute(query, [cliente_id, limite]);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener pagos por cliente: ${error.message}`);
    }
  }

  /**
   * Obtener pagos por empleado
   * @param {number} empleado_id - ID del empleado
   * @param {Object} opciones - Opciones adicionales
   * @returns {Promise<Array>} Pagos del empleado
   */
  static async obtenerPorEmpleado(empleado_id, opciones = {}) {
    const { fecha_inicio = null, fecha_fin = null, limite = 50 } = opciones;

    let whereConditions = ['c.empleado_id = ?'];
    let params = [empleado_id];

    if (fecha_inicio) {
      whereConditions.push('p.fecha_pago >= ?');
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereConditions.push('p.fecha_pago <= ?');
      params.push(fecha_fin);
    }

    const query = `
      SELECT p.*, 
             mp.nombre as metodo_pago_nombre,
             ep.nombre as estado_pago_nombre,
             c.fecha_hora_inicio,
             CONCAT(u.nombre, ' ', u.apellido) as cliente_nombre
      FROM pagos p
      JOIN citas c ON p.cita_id = c.id
      JOIN clientes cl ON c.cliente_id = cl.id
      JOIN usuarios u ON cl.usuario_id = u.id
      JOIN metodos_pago mp ON p.metodo_pago_id = mp.id
      JOIN estados_pago ep ON p.estado_pago_id = ep.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY p.fecha_pago DESC
      LIMIT ?
    `;

    try {
      const [rows] = await pool.execute(query, [...params, limite]);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener pagos por empleado: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de pagos
   * @param {Object} opciones - Opciones de filtrado
   * @returns {Promise<Object>} Estadísticas de pagos
   */
  static async obtenerEstadisticas(opciones = {}) {
    const { fecha_inicio = null, fecha_fin = null, empleado_id = null } = opciones;

    let whereConditions = [];
    let params = [];

    if (fecha_inicio) {
      whereConditions.push('p.fecha_pago >= ?');
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereConditions.push('p.fecha_pago <= ?');
      params.push(fecha_fin);
    }

    if (empleado_id) {
      whereConditions.push('c.empleado_id = ?');
      params.push(empleado_id);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        COUNT(*) as total_pagos,
        SUM(p.monto_total) as monto_total,
        SUM(p.impuesto) as impuesto_total,
        SUM(p.propina) as propina_total,
        AVG(p.monto_total) as monto_promedio,
        COUNT(CASE WHEN p.factura_emitida = 1 THEN 1 END) as facturas_emitidas
      FROM pagos p
      JOIN citas c ON p.cita_id = c.id
      ${whereClause}
    `;

    try {
      const [rows] = await pool.execute(query, params);
      return rows[0];
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  }

  /**
   * Obtener pagos por método de pago
   * @param {number} metodo_pago_id - ID del método de pago
   * @param {Object} opciones - Opciones adicionales
   * @returns {Promise<Array>} Pagos por método
   */
  static async obtenerPorMetodoPago(metodo_pago_id, opciones = {}) {
    const { fecha_inicio = null, fecha_fin = null, limite = 50 } = opciones;

    let whereConditions = ['p.metodo_pago_id = ?'];
    let params = [metodo_pago_id];

    if (fecha_inicio) {
      whereConditions.push('p.fecha_pago >= ?');
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereConditions.push('p.fecha_pago <= ?');
      params.push(fecha_fin);
    }

    const query = `
      SELECT p.*, 
             ep.nombre as estado_pago_nombre,
             c.fecha_hora_inicio,
             CONCAT(u_cliente.nombre, ' ', u_cliente.apellido) as cliente_nombre,
             CONCAT(u_empleado.nombre, ' ', u_empleado.apellido) as empleado_nombre
      FROM pagos p
      JOIN citas c ON p.cita_id = c.id
      JOIN clientes cl ON c.cliente_id = cl.id
      JOIN usuarios u_cliente ON cl.usuario_id = u_cliente.id
      JOIN empleados e ON c.empleado_id = e.id
      JOIN usuarios u_empleado ON e.usuario_id = u_empleado.id
      JOIN estados_pago ep ON p.estado_pago_id = ep.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY p.fecha_pago DESC
      LIMIT ?
    `;

    try {
      const [rows] = await pool.execute(query, [...params, limite]);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener pagos por método: ${error.message}`);
    }
  }

  /**
   * Obtener pagos por estado
   * @param {number} estado_pago_id - ID del estado de pago
   * @param {Object} opciones - Opciones adicionales
   * @returns {Promise<Array>} Pagos por estado
   */
  static async obtenerPorEstado(estado_pago_id, opciones = {}) {
    const { fecha_inicio = null, fecha_fin = null, limite = 50 } = opciones;

    let whereConditions = ['p.estado_pago_id = ?'];
    let params = [estado_pago_id];

    if (fecha_inicio) {
      whereConditions.push('p.fecha_pago >= ?');
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereConditions.push('p.fecha_pago <= ?');
      params.push(fecha_fin);
    }

    const query = `
      SELECT p.*, 
             mp.nombre as metodo_pago_nombre,
             c.fecha_hora_inicio,
             CONCAT(u_cliente.nombre, ' ', u_cliente.apellido) as cliente_nombre,
             CONCAT(u_empleado.nombre, ' ', u_empleado.apellido) as empleado_nombre
      FROM pagos p
      JOIN citas c ON p.cita_id = c.id
      JOIN clientes cl ON c.cliente_id = cl.id
      JOIN usuarios u_cliente ON cl.usuario_id = u_cliente.id
      JOIN empleados e ON c.empleado_id = e.id
      JOIN usuarios u_empleado ON e.usuario_id = u_empleado.id
      JOIN metodos_pago mp ON p.metodo_pago_id = mp.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY p.fecha_pago DESC
      LIMIT ?
    `;

    try {
      const [rows] = await pool.execute(query, [...params, limite]);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener pagos por estado: ${error.message}`);
    }
  }

  /**
   * Obtener pagos pendientes
   * @param {Object} opciones - Opciones adicionales
   * @returns {Promise<Array>} Pagos pendientes
   */
  static async obtenerPendientes(opciones = {}) {
    const { limite = 50 } = opciones;

    const query = `
      SELECT p.*, 
             mp.nombre as metodo_pago_nombre,
             ep.nombre as estado_pago_nombre,
             c.fecha_hora_inicio,
             c.fecha_hora_fin,
             CONCAT(u_cliente.nombre, ' ', u_cliente.apellido) as cliente_nombre,
             CONCAT(u_empleado.nombre, ' ', u_empleado.apellido) as empleado_nombre
      FROM pagos p
      JOIN citas c ON p.cita_id = c.id
      JOIN clientes cl ON c.cliente_id = cl.id
      JOIN usuarios u_cliente ON cl.usuario_id = u_cliente.id
      JOIN empleados e ON c.empleado_id = e.id
      JOIN usuarios u_empleado ON e.usuario_id = u_empleado.id
      JOIN metodos_pago mp ON p.metodo_pago_id = mp.id
      JOIN estados_pago ep ON p.estado_pago_id = ep.id
      WHERE ep.nombre IN ('Pendiente', 'Parcial')
      ORDER BY c.fecha_hora_inicio ASC
      LIMIT ?
    `;

    try {
      const [rows] = await pool.execute(query, [limite]);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener pagos pendientes: ${error.message}`);
    }
  }

  /**
   * Obtener pagos del día
   * @param {string} fecha - Fecha específica (YYYY-MM-DD)
   * @returns {Promise<Array>} Pagos del día
   */
  static async obtenerDelDia(fecha = null) {
    const fechaConsulta = fecha || new Date().toISOString().split('T')[0];

    const query = `
      SELECT p.*, 
             mp.nombre as metodo_pago_nombre,
             ep.nombre as estado_pago_nombre,
             c.fecha_hora_inicio,
             CONCAT(u_cliente.nombre, ' ', u_cliente.apellido) as cliente_nombre,
             CONCAT(u_empleado.nombre, ' ', u_empleado.apellido) as empleado_nombre
      FROM pagos p
      JOIN citas c ON p.cita_id = c.id
      JOIN clientes cl ON c.cliente_id = cl.id
      JOIN usuarios u_cliente ON cl.usuario_id = u_cliente.id
      JOIN empleados e ON c.empleado_id = e.id
      JOIN usuarios u_empleado ON e.usuario_id = u_empleado.id
      JOIN metodos_pago mp ON p.metodo_pago_id = mp.id
      JOIN estados_pago ep ON p.estado_pago_id = ep.id
      WHERE DATE(p.fecha_pago) = ?
      ORDER BY p.fecha_pago DESC
    `;

    try {
      const [rows] = await pool.execute(query, [fechaConsulta]);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener pagos del día: ${error.message}`);
    }
  }

  /**
   * Verificar si una cita tiene pagos
   * @param {number} cita_id - ID de la cita
   * @returns {Promise<boolean>} Tiene pagos
   */
  static async citaTienePagos(cita_id) {
    const query = 'SELECT COUNT(*) as total FROM pagos WHERE cita_id = ?';

    try {
      const [rows] = await pool.execute(query, [cita_id]);
      return rows[0].total > 0;
    } catch (error) {
      throw new Error(`Error al verificar pagos de cita: ${error.message}`);
    }
  }

  /**
   * Obtener total pagado por cita
   * @param {number} cita_id - ID de la cita
   * @returns {Promise<number>} Total pagado
   */
  static async obtenerTotalPagadoPorCita(cita_id) {
    const query = `
      SELECT COALESCE(SUM(monto_total), 0) as total_pagado
      FROM pagos 
      WHERE cita_id = ? AND estado_pago_id IN (
        SELECT id FROM estados_pago WHERE nombre IN ('Completado', 'Parcial')
      )
    `;

    try {
      const [rows] = await pool.execute(query, [cita_id]);
      return parseFloat(rows[0].total_pagado);
    } catch (error) {
      throw new Error(`Error al obtener total pagado: ${error.message}`);
    }
  }
}

module.exports = Pago; 