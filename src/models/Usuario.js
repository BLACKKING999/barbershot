const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * Modelo para la gestión de usuarios
 * Maneja operaciones CRUD, autenticación y consultas relacionadas con usuarios
 */
class Usuario {
  /**
   * Crear un nuevo usuario
   * @param {Object} usuarioData - Datos del usuario
   * @returns {Promise<Object>} Usuario creado
   */
  static async crear(usuarioData) {
    const {
      nombre,
      apellido,
      email,
      password,
      telefono,
      rol_id,
      foto_perfil = null,
      activo = true
    } = usuarioData;

    // Encriptar contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const sql = `
      INSERT INTO usuarios (
        nombre, apellido, email, password, telefono, rol_id, foto_perfil, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      nombre, apellido, email, hashedPassword, telefono, rol_id, foto_perfil, activo
    ];

    try {
      const result = await query(sql, params);
      return this.obtenerPorId(result.insertId);
    } catch (error) {
      throw new Error(`Error al crear usuario: ${error.message}`);
    }
  }

  /**
   * Obtener usuario por ID
   * @param {number} id - ID del usuario
   * @returns {Promise<Object|null>} Usuario encontrado
   */
  static async obtenerPorId(id) {
    const sql = `
      SELECT u.*, r.nombre as rol_nombre, r.permisos as rol_permisos
      FROM usuarios u
      INNER JOIN roles r ON u.rol_id = r.id
      WHERE u.id = ?
    `;

    try {
      const rows = await query(sql, [id]);
      if (rows[0]) {
        rows[0].rol_permisos = JSON.parse(rows[0].rol_permisos || '[]');
      }
      return rows[0] || null;
    } catch (error) {
      throw new Error(`Error al obtener usuario: ${error.message}`);
    }
  }

  /**
   * Obtener usuario por email
   * @param {string} email - Email del usuario
   * @returns {Promise<Object|null>} Usuario encontrado
   */
  static async obtenerPorEmail(email) {
    const sql = `
      SELECT u.*, r.nombre as rol_nombre, r.permisos as rol_permisos
      FROM usuarios u
      INNER JOIN roles r ON u.rol_id = r.id
      WHERE u.email = ?
    `;

    try {
      const rows = await query(sql, [email]);
      if (rows[0]) {
        rows[0].rol_permisos = JSON.parse(rows[0].rol_permisos || '[]');
      }
      return rows[0] || null;
    } catch (error) {
      throw new Error(`Error al obtener usuario por email: ${error.message}`);
    }
  }

  /**
   * Obtener todos los usuarios
   * @param {Object} filtros - Filtros opcionales
   * @returns {Promise<Array>} Lista de usuarios
   */
  static async obtenerTodos(filtros = {}) {
    let sql = `
      SELECT u.*, r.nombre as rol_nombre, r.permisos as rol_permisos
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
    sql += ' ORDER BY u.nombre, u.apellido';

    // Paginación
    if (filtros.limite) {
      sql += ' LIMIT ?';
      params.push(filtros.limite);
      
      if (filtros.offset) {
        sql += ' OFFSET ?';
        params.push(filtros.offset);
      }
    }

    try {
      const rows = await query(sql, params);
      
      // Parsear permisos para cada usuario
      rows.forEach(usuario => {
        usuario.rol_permisos = JSON.parse(usuario.rol_permisos || '[]');
      });

      return rows;
    } catch (error) {
      throw new Error(`Error al obtener usuarios: ${error.message}`);
    }
  }

  /**
   * Actualizar usuario
   * @param {number} id - ID del usuario
   * @param {Object} usuarioData - Datos a actualizar
   * @returns {Promise<Object>} Usuario actualizado
   */
  static async actualizar(id, usuarioData) {
    const camposPermitidos = [
      'nombre', 'apellido', 'email', 'telefono', 'rol_id', 'foto_perfil', 'activo'
    ];

    const camposActualizar = [];
    const valores = [];

    // Filtrar solo campos permitidos
    for (const campo of camposPermitidos) {
      if (usuarioData[campo] !== undefined) {
        camposActualizar.push(`${campo} = ?`);
        valores.push(usuarioData[campo]);
      }
    }

    // Manejar actualización de contraseña
    if (usuarioData.password) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(usuarioData.password, saltRounds);
      camposActualizar.push('password = ?');
      valores.push(hashedPassword);
    }

    if (camposActualizar.length === 0) {
      throw new Error('No hay campos válidos para actualizar');
    }

    valores.push(id);
    const sql = `UPDATE usuarios SET ${camposActualizar.join(', ')} WHERE id = ?`;
    
    try {
      const result = await query(sql, valores);
      
      if (result.affectedRows === 0) {
        throw new Error('Usuario no encontrado');
      }

      return this.obtenerPorId(id);
    } catch (error) {
      throw new Error(`Error al actualizar usuario: ${error.message}`);
    }
  }

  /**
   * Eliminar usuario
   * @param {number} id - ID del usuario
   * @returns {Promise<boolean>} Resultado de la operación
   */
  static async eliminar(id) {
    const sql = 'DELETE FROM usuarios WHERE id = ?';

    try {
      const result = await query(sql, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error al eliminar usuario: ${error.message}`);
    }
  }

  /**
   * Verificar credenciales de usuario
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña del usuario
   * @returns {Promise<Object|null>} Usuario autenticado o null
   */
  static async verificarCredenciales(email, password) {
    try {
      const usuario = await this.obtenerPorEmail(email);
      
      if (!usuario || !usuario.activo) {
        return null;
      }

      const passwordValido = await bcrypt.compare(password, usuario.password);
      
      if (!passwordValido) {
        return null;
      }

      // Actualizar último acceso
      await this.actualizarUltimoAcceso(usuario.id);

      return usuario;
    } catch (error) {
      throw new Error(`Error al verificar credenciales: ${error.message}`);
    }
  }

  /**
   * Actualizar último acceso
   * @param {number} id - ID del usuario
   * @returns {Promise<boolean>} Resultado de la operación
   */
  static async actualizarUltimoAcceso(id) {
    const sql = 'UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = ?';

    try {
      const result = await query(sql, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error al actualizar último acceso: ${error.message}`);
    }
  }

  /**
   * Cambiar contraseña
   * @param {number} id - ID del usuario
   * @param {string} passwordActual - Contraseña actual
   * @param {string} passwordNuevo - Nueva contraseña
   * @returns {Promise<boolean>} Resultado de la operación
   */
  static async cambiarPassword(id, passwordActual, passwordNuevo) {
    try {
      const usuario = await this.obtenerPorId(id);
      
      if (!usuario) {
        throw new Error('Usuario no encontrado');
      }

      const passwordValido = await bcrypt.compare(passwordActual, usuario.password);
      
      if (!passwordValido) {
        throw new Error('Contraseña actual incorrecta');
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(passwordNuevo, saltRounds);

      const sql = 'UPDATE usuarios SET password = ? WHERE id = ?';
      const result = await query(sql, [hashedPassword, id]);

      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error al cambiar contraseña: ${error.message}`);
    }
  }

  /**
   * Verificar si existe un email
   * @param {string} email - Email a verificar
   * @param {number} excludeId - ID a excluir (para actualizaciones)
   * @returns {Promise<boolean>} Existe el email
   */
  static async existeEmail(email, excludeId = null) {
    let sql = 'SELECT COUNT(*) as total FROM usuarios WHERE email = ?';
    let params = [email];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    try {
      const rows = await query(sql, params);
      return rows[0].total > 0;
    } catch (error) {
      throw new Error(`Error al verificar email: ${error.message}`);
    }
  }

  /**
   * Buscar usuarios
   * @param {string} termino - Término de búsqueda
   * @returns {Promise<Array>} Usuarios encontrados
   */
  static async buscar(termino) {
    const sql = `
      SELECT u.*, r.nombre as rol_nombre, r.permisos as rol_permisos
      FROM usuarios u
      INNER JOIN roles r ON u.rol_id = r.id
      WHERE u.nombre LIKE ? OR u.apellido LIKE ? OR u.email LIKE ?
      ORDER BY u.nombre, u.apellido
    `;

    const busqueda = `%${termino}%`;

    try {
      const rows = await query(sql, [busqueda, busqueda, busqueda]);
      
      // Parsear permisos para cada usuario
      rows.forEach(usuario => {
        usuario.rol_permisos = JSON.parse(usuario.rol_permisos || '[]');
      });

      return rows;
    } catch (error) {
      throw new Error(`Error al buscar usuarios: ${error.message}`);
    }
  }

  /**
   * Obtener usuarios por rol
   * @param {number} rol_id - ID del rol
   * @returns {Promise<Array>} Usuarios del rol
   */
  static async obtenerPorRol(rol_id) {
    const sql = `
      SELECT u.*, r.nombre as rol_nombre, r.permisos as rol_permisos
      FROM usuarios u
      INNER JOIN roles r ON u.rol_id = r.id
      WHERE u.rol_id = ?
      ORDER BY u.nombre, u.apellido
    `;

    try {
      const rows = await query(sql, [rol_id]);
      
      // Parsear permisos para cada usuario
      rows.forEach(usuario => {
        usuario.rol_permisos = JSON.parse(usuario.rol_permisos || '[]');
      });

      return rows;
    } catch (error) {
      throw new Error(`Error al obtener usuarios por rol: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de usuarios
   * @returns {Promise<Object>} Estadísticas de usuarios
   */
  static async obtenerEstadisticas() {
    const sql = `
      SELECT 
        COUNT(*) as total_usuarios,
        COUNT(CASE WHEN activo = true THEN 1 END) as usuarios_activos,
        COUNT(CASE WHEN activo = false THEN 1 END) as usuarios_inactivos,
        COUNT(CASE WHEN ultimo_acceso >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as usuarios_activos_semana,
        COUNT(CASE WHEN ultimo_acceso >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as usuarios_activos_mes
      FROM usuarios
    `;

    try {
      const rows = await query(sql);
      return rows[0];
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  }
}

module.exports = Usuario; 