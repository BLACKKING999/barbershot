const pool = require('../config/database');

/**
 * Modelo para la gestión de notificaciones
 * Maneja operaciones CRUD, búsquedas, filtros y estadísticas de notificaciones
 */
class Notificacion {
  /**
   * Crear una nueva notificación
   * @param {Object} notificacion - Datos de la notificación
   * @returns {Promise<Object>} Notificación creada
   */
  static async crear(notificacion) {
    const {
      usuario_id,
      titulo,
      mensaje,
      tipo,
      leida = 0,
      enlace
    } = notificacion;

    const query = `
      INSERT INTO notificaciones (
        usuario_id, titulo, mensaje, tipo, leida, enlace
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    try {
      const [result] = await pool.execute(query, [
        usuario_id, titulo, mensaje, tipo, leida, enlace
      ]);

      return this.obtenerPorId(result.insertId);
    } catch (error) {
      throw new Error(`Error al crear notificación: ${error.message}`);
    }
  }

  /**
   * Obtener notificación por ID
   * @param {number} id - ID de la notificación
   * @returns {Promise<Object|null>} Notificación encontrada
   */
  static async obtenerPorId(id) {
    const query = `
      SELECT n.*, 
             CONCAT(u.nombre, ' ', u.apellido) as usuario_nombre,
             u.email as usuario_email
      FROM notificaciones n
      JOIN usuarios u ON n.usuario_id = u.id
      WHERE n.id = ?
    `;

    try {
      const [rows] = await pool.execute(query, [id]);
      return rows[0] || null;
    } catch (error) {
      throw new Error(`Error al obtener notificación: ${error.message}`);
    }
  }

  /**
   * Obtener todas las notificaciones con paginación
   * @param {Object} opciones - Opciones de paginación y filtros
   * @returns {Promise<Object>} Lista de notificaciones y metadatos
   */
  static async obtenerTodas(opciones = {}) {
    const {
      pagina = 1,
      limite = 10,
      usuario_id = null,
      tipo = null,
      leida = null,
      fecha_inicio = null,
      fecha_fin = null,
      orden = 'created_at',
      direccion = 'DESC'
    } = opciones;

    let whereConditions = [];
    let params = [];

    if (usuario_id) {
      whereConditions.push('n.usuario_id = ?');
      params.push(usuario_id);
    }

    if (tipo) {
      whereConditions.push('n.tipo = ?');
      params.push(tipo);
    }

    if (leida !== null) {
      whereConditions.push('n.leida = ?');
      params.push(leida);
    }

    if (fecha_inicio) {
      whereConditions.push('n.created_at >= ?');
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereConditions.push('n.created_at <= ?');
      params.push(fecha_fin);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const offset = (pagina - 1) * limite;
    const query = `
      SELECT n.*, 
             CONCAT(u.nombre, ' ', u.apellido) as usuario_nombre,
             u.email as usuario_email
      FROM notificaciones n
      JOIN usuarios u ON n.usuario_id = u.id
      ${whereClause}
      ORDER BY n.${orden} ${direccion}
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM notificaciones n
      ${whereClause}
    `;

    try {
      const [rows] = await pool.execute(query, [...params, limite, offset]);
      const [countResult] = await pool.execute(countQuery, params);

      return {
        notificaciones: rows,
        paginacion: {
          pagina,
          limite,
          total: countResult[0].total,
          totalPaginas: Math.ceil(countResult[0].total / limite)
        }
      };
    } catch (error) {
      throw new Error(`Error al obtener notificaciones: ${error.message}`);
    }
  }

  /**
   * Actualizar notificación
   * @param {number} id - ID de la notificación
   * @param {Object} datos - Datos a actualizar
   * @returns {Promise<Object>} Notificación actualizada
   */
  static async actualizar(id, datos) {
    const camposPermitidos = [
      'titulo', 'mensaje', 'tipo', 'leida', 'fecha_lectura', 'enlace'
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
      UPDATE notificaciones 
      SET ${camposActualizar.join(', ')}
      WHERE id = ?
    `;

    try {
      const [result] = await pool.execute(query, valores);
      
      if (result.affectedRows === 0) {
        throw new Error('Notificación no encontrada');
      }

      return this.obtenerPorId(id);
    } catch (error) {
      throw new Error(`Error al actualizar notificación: ${error.message}`);
    }
  }

  /**
   * Eliminar notificación
   * @param {number} id - ID de la notificación
   * @returns {Promise<boolean>} Resultado de la operación
   */
  static async eliminar(id) {
    const query = 'DELETE FROM notificaciones WHERE id = ?';

    try {
      const [result] = await pool.execute(query, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error al eliminar notificación: ${error.message}`);
    }
  }

  /**
   * Obtener notificaciones por usuario
   * @param {number} usuario_id - ID del usuario
   * @param {Object} opciones - Opciones adicionales
   * @returns {Promise<Array>} Notificaciones del usuario
   */
  static async obtenerPorUsuario(usuario_id, opciones = {}) {
    const {
      leida = null,
      tipo = null,
      limite = 20,
      orden = 'created_at DESC'
    } = opciones;

    let whereConditions = ['n.usuario_id = ?'];
    let params = [usuario_id];

    if (leida !== null) {
      whereConditions.push('n.leida = ?');
      params.push(leida);
    }

    if (tipo) {
      whereConditions.push('n.tipo = ?');
      params.push(tipo);
    }

    const query = `
      SELECT n.*
      FROM notificaciones n
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY n.${orden}
      LIMIT ?
    `;

    try {
      const [rows] = await pool.execute(query, [...params, limite]);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener notificaciones por usuario: ${error.message}`);
    }
  }

  /**
   * Marcar notificación como leída
   * @param {number} id - ID de la notificación
   * @returns {Promise<Object>} Notificación actualizada
   */
  static async marcarComoLeida(id) {
    const query = `
      UPDATE notificaciones 
      SET leida = 1, fecha_lectura = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    try {
      const [result] = await pool.execute(query, [id]);
      
      if (result.affectedRows === 0) {
        throw new Error('Notificación no encontrada');
      }

      return this.obtenerPorId(id);
    } catch (error) {
      throw new Error(`Error al marcar como leída: ${error.message}`);
    }
  }

  /**
   * Marcar múltiples notificaciones como leídas
   * @param {Array} ids - Array de IDs de notificaciones
   * @returns {Promise<boolean>} Resultado de la operación
   */
  static async marcarMultiplesComoLeidas(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('Se requiere un array de IDs válido');
    }

    const placeholders = ids.map(() => '?').join(',');
    const query = `
      UPDATE notificaciones 
      SET leida = 1, fecha_lectura = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `;

    try {
      const [result] = await pool.execute(query, ids);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error al marcar múltiples como leídas: ${error.message}`);
    }
  }

  /**
   * Obtener notificaciones no leídas por usuario
   * @param {number} usuario_id - ID del usuario
   * @param {number} limite - Límite de resultados
   * @returns {Promise<Array>} Notificaciones no leídas
   */
  static async obtenerNoLeidasPorUsuario(usuario_id, limite = 10) {
    const query = `
      SELECT n.*
      FROM notificaciones n
      WHERE n.usuario_id = ? AND n.leida = 0
      ORDER BY n.created_at DESC
      LIMIT ?
    `;

    try {
      const [rows] = await pool.execute(query, [usuario_id, limite]);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener notificaciones no leídas: ${error.message}`);
    }
  }

  /**
   * Contar notificaciones no leídas por usuario
   * @param {number} usuario_id - ID del usuario
   * @returns {Promise<number>} Cantidad de notificaciones no leídas
   */
  static async contarNoLeidasPorUsuario(usuario_id) {
    const query = `
      SELECT COUNT(*) as total
      FROM notificaciones
      WHERE usuario_id = ? AND leida = 0
    `;

    try {
      const [rows] = await pool.execute(query, [usuario_id]);
      return rows[0].total;
    } catch (error) {
      throw new Error(`Error al contar notificaciones no leídas: ${error.message}`);
    }
  }

  /**
   * Obtener notificaciones por tipo
   * @param {string} tipo - Tipo de notificación
   * @param {Object} opciones - Opciones adicionales
   * @returns {Promise<Array>} Notificaciones del tipo
   */
  static async obtenerPorTipo(tipo, opciones = {}) {
    const { limite = 50, leida = null } = opciones;

    let whereConditions = ['n.tipo = ?'];
    let params = [tipo];

    if (leida !== null) {
      whereConditions.push('n.leida = ?');
      params.push(leida);
    }

    const query = `
      SELECT n.*, 
             CONCAT(u.nombre, ' ', u.apellido) as usuario_nombre,
             u.email as usuario_email
      FROM notificaciones n
      JOIN usuarios u ON n.usuario_id = u.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY n.created_at DESC
      LIMIT ?
    `;

    try {
      const [rows] = await pool.execute(query, [...params, limite]);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener notificaciones por tipo: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de notificaciones
   * @param {Object} opciones - Opciones de filtrado
   * @returns {Promise<Object>} Estadísticas de notificaciones
   */
  static async obtenerEstadisticas(opciones = {}) {
    const { usuario_id = null, fecha_inicio = null, fecha_fin = null } = opciones;

    let whereConditions = [];
    let params = [];

    if (usuario_id) {
      whereConditions.push('usuario_id = ?');
      params.push(usuario_id);
    }

    if (fecha_inicio) {
      whereConditions.push('created_at >= ?');
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereConditions.push('created_at <= ?');
      params.push(fecha_fin);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        COUNT(*) as total_notificaciones,
        COUNT(CASE WHEN leida = 1 THEN 1 END) as leidas,
        COUNT(CASE WHEN leida = 0 THEN 1 END) as no_leidas,
        COUNT(CASE WHEN tipo = 'cita' THEN 1 END) as tipo_cita,
        COUNT(CASE WHEN tipo = 'recordatorio' THEN 1 END) as tipo_recordatorio,
        COUNT(CASE WHEN tipo = 'sistema' THEN 1 END) as tipo_sistema,
        COUNT(CASE WHEN tipo = 'promocion' THEN 1 END) as tipo_promocion
      FROM notificaciones
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
   * Crear notificación de recordatorio de cita
   * @param {number} cita_id - ID de la cita
   * @param {string} mensaje - Mensaje personalizado
   * @returns {Promise<Object>} Notificación creada
   */
  static async crearRecordatorioCita(cita_id, mensaje = null) {
    const query = `
      SELECT 
        c.id as cita_id,
        c.fecha_hora_inicio,
        c.fecha_hora_fin,
        cl.usuario_id,
        CONCAT(u_cliente.nombre, ' ', u_cliente.apellido) as cliente_nombre,
        CONCAT(u_empleado.nombre, ' ', u_empleado.apellido) as empleado_nombre,
        GROUP_CONCAT(s.nombre SEPARATOR ', ') as servicios
      FROM citas c
      JOIN clientes cl ON c.cliente_id = cl.id
      JOIN usuarios u_cliente ON cl.usuario_id = u_cliente.id
      JOIN empleados e ON c.empleado_id = e.id
      JOIN usuarios u_empleado ON e.usuario_id = u_empleado.id
      JOIN cita_servicio cs ON c.id = cs.cita_id
      JOIN servicios s ON cs.servicio_id = s.id
      WHERE c.id = ?
      GROUP BY c.id
    `;

    try {
      const [rows] = await pool.execute(query, [cita_id]);
      
      if (rows.length === 0) {
        throw new Error('Cita no encontrada');
      }

      const cita = rows[0];
      const titulo = 'Recordatorio de Cita';
      const mensajeDefault = `Tienes una cita programada para el ${new Date(cita.fecha_hora_inicio).toLocaleDateString()} a las ${new Date(cita.fecha_hora_inicio).toLocaleTimeString()} con ${cita.empleado_nombre}. Servicios: ${cita.servicios}`;
      
      return this.crear({
        usuario_id: cita.usuario_id,
        titulo,
        mensaje: mensaje || mensajeDefault,
        tipo: 'recordatorio',
        enlace: `/citas/${cita_id}`
      });
    } catch (error) {
      throw new Error(`Error al crear recordatorio: ${error.message}`);
    }
  }

  /**
   * Crear notificación de sistema
   * @param {number} usuario_id - ID del usuario
   * @param {string} titulo - Título de la notificación
   * @param {string} mensaje - Mensaje de la notificación
   * @param {string} enlace - Enlace opcional
   * @returns {Promise<Object>} Notificación creada
   */
  static async crearNotificacionSistema(usuario_id, titulo, mensaje, enlace = null) {
    return this.crear({
      usuario_id,
      titulo,
      mensaje,
      tipo: 'sistema',
      enlace
    });
  }

  /**
   * Crear notificación de promoción
   * @param {Array} usuario_ids - Array de IDs de usuarios
   * @param {string} titulo - Título de la promoción
   * @param {string} mensaje - Mensaje de la promoción
   * @param {string} enlace - Enlace a la promoción
   * @returns {Promise<Array>} Notificaciones creadas
   */
  static async crearNotificacionPromocion(usuario_ids, titulo, mensaje, enlace = null) {
    const notificaciones = [];

    for (const usuario_id of usuario_ids) {
      try {
        const notificacion = await this.crear({
          usuario_id,
          titulo,
          mensaje,
          tipo: 'promocion',
          enlace
        });
        notificaciones.push(notificacion);
      } catch (error) {
        console.error(`Error al crear notificación para usuario ${usuario_id}:`, error);
      }
    }

    return notificaciones;
  }

  /**
   * Limpiar notificaciones antiguas
   * @param {number} dias - Días de antigüedad para eliminar
   * @returns {Promise<number>} Cantidad de notificaciones eliminadas
   */
  static async limpiarAntiguas(dias = 30) {
    const query = `
      DELETE FROM notificaciones 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      AND leida = 1
    `;

    try {
      const [result] = await pool.execute(query, [dias]);
      return result.affectedRows;
    } catch (error) {
      throw new Error(`Error al limpiar notificaciones antiguas: ${error.message}`);
    }
  }
}

module.exports = Notificacion; 