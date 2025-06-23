const { query } = require('../config/database');

/**
 * Modelo para la tabla usuarios
 * Maneja todas las operaciones CRUD y consultas relacionadas con usuarios
 */
class Usuario {
  /**
   * Crear un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Object} - Usuario creado
   */
  static async crear(userData) {
    try {
      const {
        firebase_uid,
        email,
        nombre,
        apellido,
        telefono,
        foto_perfil,
        rol_id,
        activo = 1,
        notificacion_correo = 1,
        notificacion_push = 0,
        notificacion_sms = 0,
        recordatorio_horas_antes = 24
      } = userData;

      const sql = `
        INSERT INTO usuarios (
          firebase_uid, email, nombre, apellido, telefono, foto_perfil,
          rol_id, activo, notificacion_correo, notificacion_push,
          notificacion_sms, recordatorio_horas_antes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        firebase_uid, email, nombre, apellido, telefono, foto_perfil,
        rol_id, activo, notificacion_correo, notificacion_push,
        notificacion_sms, recordatorio_horas_antes
      ];

      const result = await query(sql, params);
      return { id: result.insertId, ...userData };
    } catch (error) {
      console.error('Error creando usuario:', error);
      throw error;
    }
  }

  /**
   * Obtener usuario por ID
   * @param {number} id - ID del usuario
   * @returns {Object|null} - Usuario encontrado o null
   */
  static async obtenerPorId(id) {
    try {
      const sql = `
        SELECT u.*, r.nombre as rol_nombre, r.descripcion as rol_descripcion
        FROM usuarios u
        INNER JOIN roles r ON u.rol_id = r.id
        WHERE u.id = ?
      `;
      
      const usuarios = await query(sql, [id]);
      return usuarios.length > 0 ? usuarios[0] : null;
    } catch (error) {
      console.error('Error obteniendo usuario por ID:', error);
      throw error;
    }
  }

  /**
   * Obtener usuario por Firebase UID
   * @param {string} firebase_uid - Firebase UID del usuario
   * @returns {Object|null} - Usuario encontrado o null
   */
  static async obtenerPorFirebaseUid(firebase_uid) {
    try {
      const sql = `
        SELECT u.*, r.nombre as rol_nombre, r.descripcion as rol_descripcion
        FROM usuarios u
        INNER JOIN roles r ON u.rol_id = r.id
        WHERE u.firebase_uid = ?
      `;
      
      const usuarios = await query(sql, [firebase_uid]);
      return usuarios.length > 0 ? usuarios[0] : null;
    } catch (error) {
      console.error('Error obteniendo usuario por Firebase UID:', error);
      throw error;
    }
  }

  /**
   * Obtener usuario por email
   * @param {string} email - Email del usuario
   * @returns {Object|null} - Usuario encontrado o null
   */
  static async obtenerPorEmail(email) {
    try {
      const sql = `
        SELECT u.*, r.nombre as rol_nombre, r.descripcion as rol_descripcion
        FROM usuarios u
        INNER JOIN roles r ON u.rol_id = r.id
        WHERE u.email = ?
      `;
      
      const usuarios = await query(sql, [email]);
      return usuarios.length > 0 ? usuarios[0] : null;
    } catch (error) {
      console.error('Error obteniendo usuario por email:', error);
      throw error;
    }
  }

  /**
   * Obtener todos los usuarios con filtros opcionales
   * @param {Object} filtros - Filtros opcionales
   * @returns {Array} - Lista de usuarios
   */
  static async obtenerTodos(filtros = {}) {
    try {
      let sql = `
        SELECT u.*, r.nombre as rol_nombre, r.descripcion as rol_descripcion
        FROM usuarios u
        INNER JOIN roles r ON u.rol_id = r.id
      `;
      
      const params = [];
      const condiciones = [];

      // Aplicar filtros
      if (filtros.activo !== undefined) {
        condiciones.push('u.activo = ?');
        params.push(filtros.activo);
      }

      if (filtros.rol_id) {
        condiciones.push('u.rol_id = ?');
        params.push(filtros.rol_id);
      }

      if (filtros.busqueda) {
        condiciones.push('(u.nombre LIKE ? OR u.apellido LIKE ? OR u.email LIKE ?)');
        const busqueda = `%${filtros.busqueda}%`;
        params.push(busqueda, busqueda, busqueda);
      }

      if (condiciones.length > 0) {
        sql += ' WHERE ' + condiciones.join(' AND ');
      }

      // Ordenamiento
      sql += ' ORDER BY u.fecha_registro DESC';

      // Paginación
      if (filtros.limite) {
        sql += ' LIMIT ?';
        params.push(filtros.limite);
        
        if (filtros.offset) {
          sql += ' OFFSET ?';
          params.push(filtros.offset);
        }
      }

      const usuarios = await query(sql, params);
      return usuarios;
    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      throw error;
    }
  }

  /**
   * Actualizar usuario
   * @param {number} id - ID del usuario
   * @param {Object} userData - Datos a actualizar
   * @returns {boolean} - True si se actualizó correctamente
   */
  static async actualizar(id, userData) {
    try {
      const camposPermitidos = [
        'nombre', 'apellido', 'telefono', 'foto_perfil', 'rol_id',
        'activo', 'notificacion_correo', 'notificacion_push',
        'notificacion_sms', 'recordatorio_horas_antes'
      ];

      const camposActualizar = [];
      const valores = [];

      // Filtrar solo campos permitidos
      for (const campo of camposPermitidos) {
        if (userData[campo] !== undefined) {
          camposActualizar.push(`${campo} = ?`);
          valores.push(userData[campo]);
        }
      }

      if (camposActualizar.length === 0) {
        throw new Error('No hay campos válidos para actualizar');
      }

      valores.push(id);
      const sql = `UPDATE usuarios SET ${camposActualizar.join(', ')} WHERE id = ?`;
      
      const result = await query(sql, valores);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      throw error;
    }
  }

  /**
   * Actualizar último acceso
   * @param {number} id - ID del usuario
   * @returns {boolean} - True si se actualizó correctamente
   */
  static async actualizarUltimoAcceso(id) {
    try {
      const sql = 'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?';
      const result = await query(sql, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error actualizando último acceso:', error);
      throw error;
    }
  }

  /**
   * Eliminar usuario (marcar como inactivo)
   * @param {number} id - ID del usuario
   * @returns {boolean} - True si se eliminó correctamente
   */
  static async eliminar(id) {
    try {
      const sql = 'UPDATE usuarios SET activo = 0 WHERE id = ?';
      const result = await query(sql, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      throw error;
    }
  }

  /**
   * Eliminar usuario permanentemente
   * @param {number} id - ID del usuario
   * @returns {boolean} - True si se eliminó correctamente
   */
  static async eliminarPermanentemente(id) {
    try {
      const sql = 'DELETE FROM usuarios WHERE id = ?';
      const result = await query(sql, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error eliminando usuario permanentemente:', error);
      throw error;
    }
  }

  /**
   * Verificar si existe un usuario por email
   * @param {string} email - Email a verificar
   * @param {number} excludeId - ID a excluir (para actualizaciones)
   * @returns {boolean} - True si existe
   */
  static async existePorEmail(email, excludeId = null) {
    try {
      let sql = 'SELECT COUNT(*) as count FROM usuarios WHERE email = ?';
      const params = [email];

      if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
      }

      const result = await query(sql, params);
      return result[0].count > 0;
    } catch (error) {
      console.error('Error verificando existencia por email:', error);
      throw error;
    }
  }

  /**
   * Verificar si existe un usuario por Firebase UID
   * @param {string} firebase_uid - Firebase UID a verificar
   * @param {number} excludeId - ID a excluir (para actualizaciones)
   * @returns {boolean} - True si existe
   */
  static async existePorFirebaseUid(firebase_uid, excludeId = null) {
    try {
      let sql = 'SELECT COUNT(*) as count FROM usuarios WHERE firebase_uid = ?';
      const params = [firebase_uid];

      if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
      }

      const result = await query(sql, params);
      return result[0].count > 0;
    } catch (error) {
      console.error('Error verificando existencia por Firebase UID:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de usuarios
   * @returns {Object} - Estadísticas
   */
  static async obtenerEstadisticas() {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_usuarios,
          SUM(CASE WHEN activo = 1 THEN 1 ELSE 0 END) as usuarios_activos,
          SUM(CASE WHEN activo = 0 THEN 1 ELSE 0 END) as usuarios_inactivos,
          COUNT(DISTINCT rol_id) as roles_diferentes,
          DATE(ultimo_acceso) as ultimo_acceso_fecha
        FROM usuarios
        ORDER BY ultimo_acceso DESC
        LIMIT 1
      `;

      const result = await query(sql);
      return result[0];
    } catch (error) {
      console.error('Error obteniendo estadísticas de usuarios:', error);
      throw error;
    }
  }

  /**
   * Obtener usuarios por rol
   * @param {number} rol_id - ID del rol
   * @returns {Array} - Lista de usuarios del rol
   */
  static async obtenerPorRol(rol_id) {
    try {
      const sql = `
        SELECT u.*, r.nombre as rol_nombre
        FROM usuarios u
        INNER JOIN roles r ON u.rol_id = r.id
        WHERE u.rol_id = ? AND u.activo = 1
        ORDER BY u.nombre, u.apellido
      `;

      const usuarios = await query(sql, [rol_id]);
      return usuarios;
    } catch (error) {
      console.error('Error obteniendo usuarios por rol:', error);
      throw error;
    }
  }

  /**
   * Buscar usuarios
   * @param {string} termino - Término de búsqueda
   * @returns {Array} - Lista de usuarios que coinciden
   */
  static async buscar(termino) {
    try {
      const sql = `
        SELECT u.*, r.nombre as rol_nombre
        FROM usuarios u
        INNER JOIN roles r ON u.rol_id = r.id
        WHERE u.activo = 1 AND (
          u.nombre LIKE ? OR 
          u.apellido LIKE ? OR 
          u.email LIKE ? OR
          CONCAT(u.nombre, ' ', u.apellido) LIKE ?
        )
        ORDER BY u.nombre, u.apellido
        LIMIT 20
      `;

      const busqueda = `%${termino}%`;
      const usuarios = await query(sql, [busqueda, busqueda, busqueda, busqueda]);
      return usuarios;
    } catch (error) {
      console.error('Error buscando usuarios:', error);
      throw error;
    }
  }
}

module.exports = Usuario; 