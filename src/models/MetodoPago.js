const pool = require('../config/database');

/**
 * Modelo para la gestión de métodos de pago
 * Maneja operaciones CRUD, búsquedas, filtros y estadísticas de métodos de pago
 */
class MetodoPago {
  /**
   * Crear un nuevo método de pago
   * @param {Object} metodoPago - Datos del método de pago
   * @returns {Promise<Object>} Método de pago creado
   */
  static async crear(metodoPago) {
    const { nombre, descripcion, activo = 1 } = metodoPago;

    const query = `
      INSERT INTO metodos_pago (nombre, descripcion, activo)
      VALUES (?, ?, ?)
    `;

    try {
      const [result] = await pool.execute(query, [nombre, descripcion, activo]);
      return this.obtenerPorId(result.insertId);
    } catch (error) {
      throw new Error(`Error al crear método de pago: ${error.message}`);
    }
  }

  /**
   * Obtener método de pago por ID
   * @param {number} id - ID del método de pago
   * @returns {Promise<Object|null>} Método de pago encontrado
   */
  static async obtenerPorId(id) {
    const query = `
      SELECT mp.*, 
             COUNT(p.id) as total_pagos,
             SUM(p.monto_total) as monto_total_procesado,
             AVG(p.monto_total) as monto_promedio
      FROM metodos_pago mp
      LEFT JOIN pagos p ON mp.id = p.metodo_pago_id
      WHERE mp.id = ?
      GROUP BY mp.id
    `;

    try {
      const [rows] = await pool.execute(query, [id]);
      return rows[0] || null;
    } catch (error) {
      throw new Error(`Error al obtener método de pago: ${error.message}`);
    }
  }

  /**
   * Obtener todos los métodos de pago
   * @param {Object} opciones - Opciones de filtrado
   * @returns {Promise<Array>} Lista de métodos de pago
   */
  static async obtenerTodos(opciones = {}) {
    const { activo = null, incluirEstadisticas = false } = opciones;

    let whereConditions = [];
    let params = [];

    if (activo !== null) {
      whereConditions.push('mp.activo = ?');
      params.push(activo);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT mp.*, 
             COUNT(p.id) as total_pagos,
             SUM(p.monto_total) as monto_total_procesado,
             AVG(p.monto_total) as monto_promedio
      FROM metodos_pago mp
      LEFT JOIN pagos p ON mp.id = p.metodo_pago_id
      ${whereClause}
      GROUP BY mp.id
      ORDER BY mp.nombre
    `;

    try {
      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener métodos de pago: ${error.message}`);
    }
  }

  /**
   * Actualizar método de pago
   * @param {number} id - ID del método de pago
   * @param {Object} datos - Datos a actualizar
   * @returns {Promise<Object>} Método de pago actualizado
   */
  static async actualizar(id, datos) {
    const camposPermitidos = ['nombre', 'descripcion', 'activo'];
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
      UPDATE metodos_pago 
      SET ${camposActualizar.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    try {
      const [result] = await pool.execute(query, valores);
      
      if (result.affectedRows === 0) {
        throw new Error('Método de pago no encontrado');
      }

      return this.obtenerPorId(id);
    } catch (error) {
      throw new Error(`Error al actualizar método de pago: ${error.message}`);
    }
  }

  /**
   * Eliminar método de pago
   * @param {number} id - ID del método de pago
   * @returns {Promise<boolean>} Resultado de la operación
   */
  static async eliminar(id) {
    // Verificar si tiene pagos asociados
    const pagos = await this.obtenerPagosPorMetodo(id);
    if (pagos.length > 0) {
      throw new Error('No se puede eliminar un método de pago que tiene pagos asociados');
    }

    const query = 'DELETE FROM metodos_pago WHERE id = ?';

    try {
      const [result] = await pool.execute(query, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error al eliminar método de pago: ${error.message}`);
    }
  }

  /**
   * Obtener métodos de pago activos
   * @returns {Promise<Array>} Métodos de pago activos
   */
  static async obtenerActivos() {
    const query = `
      SELECT mp.*
      FROM metodos_pago mp
      WHERE mp.activo = 1
      ORDER BY mp.nombre
    `;

    try {
      const [rows] = await pool.execute(query);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener métodos de pago activos: ${error.message}`);
    }
  }

  /**
   * Buscar métodos de pago por nombre
   * @param {string} termino - Término de búsqueda
   * @returns {Promise<Array>} Métodos de pago encontrados
   */
  static async buscar(termino) {
    const query = `
      SELECT mp.*, 
             COUNT(p.id) as total_pagos
      FROM metodos_pago mp
      LEFT JOIN pagos p ON mp.id = p.metodo_pago_id
      WHERE mp.nombre LIKE ? OR mp.descripcion LIKE ?
      GROUP BY mp.id
      ORDER BY mp.nombre
    `;

    const busquedaParam = `%${termino}%`;

    try {
      const [rows] = await pool.execute(query, [busquedaParam, busquedaParam]);
      return rows;
    } catch (error) {
      throw new Error(`Error al buscar métodos de pago: ${error.message}`);
    }
  }

  /**
   * Obtener pagos por método de pago
   * @param {number} metodo_pago_id - ID del método de pago
   * @param {Object} opciones - Opciones adicionales
   * @returns {Promise<Array>} Pagos del método
   */
  static async obtenerPagosPorMetodo(metodo_pago_id, opciones = {}) {
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
   * Obtener estadísticas de métodos de pago
   * @param {Object} opciones - Opciones de filtrado
   * @returns {Promise<Object>} Estadísticas de métodos de pago
   */
  static async obtenerEstadisticas(opciones = {}) {
    const { fecha_inicio = null, fecha_fin = null } = opciones;

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

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        mp.id,
        mp.nombre,
        mp.activo,
        COUNT(p.id) as total_pagos,
        SUM(p.monto_total) as monto_total_procesado,
        AVG(p.monto_total) as monto_promedio,
        MIN(p.monto_total) as monto_minimo,
        MAX(p.monto_total) as monto_maximo
      FROM metodos_pago mp
      LEFT JOIN pagos p ON mp.id = p.metodo_pago_id
      ${whereClause}
      GROUP BY mp.id
      ORDER BY monto_total_procesado DESC
    `;

    try {
      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  }

  /**
   * Obtener método de pago más utilizado
   * @param {Object} opciones - Opciones de filtrado
   * @returns {Promise<Object>} Método de pago más utilizado
   */
  static async obtenerMasUtilizado(opciones = {}) {
    const { fecha_inicio = null, fecha_fin = null } = opciones;

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

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        mp.id,
        mp.nombre,
        mp.descripcion,
        COUNT(p.id) as total_pagos,
        SUM(p.monto_total) as monto_total_procesado,
        AVG(p.monto_total) as monto_promedio
      FROM metodos_pago mp
      LEFT JOIN pagos p ON mp.id = p.metodo_pago_id
      ${whereClause}
      GROUP BY mp.id
      ORDER BY total_pagos DESC
      LIMIT 1
    `;

    try {
      const [rows] = await pool.execute(query, params);
      return rows[0] || null;
    } catch (error) {
      throw new Error(`Error al obtener método más utilizado: ${error.message}`);
    }
  }

  /**
   * Obtener métodos de pago por período
   * @param {string} fecha_inicio - Fecha de inicio
   * @param {string} fecha_fin - Fecha de fin
   * @returns {Promise<Array>} Métodos de pago por período
   */
  static async obtenerPorPeriodo(fecha_inicio, fecha_fin) {
    const query = `
      SELECT 
        mp.id,
        mp.nombre,
        mp.descripcion,
        COUNT(p.id) as total_pagos,
        SUM(p.monto_total) as monto_total_procesado,
        AVG(p.monto_total) as monto_promedio
      FROM metodos_pago mp
      LEFT JOIN pagos p ON mp.id = p.metodo_pago_id
      WHERE p.fecha_pago BETWEEN ? AND ?
      GROUP BY mp.id
      ORDER BY monto_total_procesado DESC
    `;

    try {
      const [rows] = await pool.execute(query, [fecha_inicio, fecha_fin]);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener métodos por período: ${error.message}`);
    }
  }

  /**
   * Verificar si un método de pago existe
   * @param {string} nombre - Nombre del método de pago
   * @param {number} excludeId - ID a excluir (para actualizaciones)
   * @returns {Promise<boolean>} Existe el método de pago
   */
  static async existe(nombre, excludeId = null) {
    let query = 'SELECT COUNT(*) as total FROM metodos_pago WHERE nombre = ?';
    let params = [nombre];

    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }

    try {
      const [rows] = await pool.execute(query, params);
      return rows[0].total > 0;
    } catch (error) {
      throw new Error(`Error al verificar existencia: ${error.message}`);
    }
  }

  /**
   * Obtener métodos de pago sin uso
   * @returns {Promise<Array>} Métodos de pago sin uso
   */
  static async obtenerSinUso() {
    const query = `
      SELECT mp.*, 
             COUNT(p.id) as total_pagos
      FROM metodos_pago mp
      LEFT JOIN pagos p ON mp.id = p.metodo_pago_id
      GROUP BY mp.id
      HAVING total_pagos = 0
      ORDER BY mp.nombre
    `;

    try {
      const [rows] = await pool.execute(query);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener métodos sin uso: ${error.message}`);
    }
  }

  /**
   * Activar/desactivar método de pago
   * @param {number} id - ID del método de pago
   * @param {boolean} activo - Estado activo
   * @returns {Promise<Object>} Método de pago actualizado
   */
  static async cambiarEstado(id, activo) {
    const query = `
      UPDATE metodos_pago 
      SET activo = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    try {
      const [result] = await pool.execute(query, [activo ? 1 : 0, id]);
      
      if (result.affectedRows === 0) {
        throw new Error('Método de pago no encontrado');
      }

      return this.obtenerPorId(id);
    } catch (error) {
      throw new Error(`Error al cambiar estado: ${error.message}`);
    }
  }
}

module.exports = MetodoPago; 