const { query } = require('../config/database');

/**
 * Modelo para la tabla roles
 * Maneja todas las operaciones CRUD y consultas relacionadas con roles
 */
class Rol {
  /**
   * Crear un nuevo rol
   * @param {Object} rolData - Datos del rol
   * @returns {Object} - Rol creado
   */
  static async crear(rolData) {
    try {
      const { nombre, descripcion } = rolData;

      const sql = 'INSERT INTO roles (nombre, descripcion) VALUES (?, ?)';
      const params = [nombre, descripcion];

      const result = await query(sql, params);
      return { id: result.insertId, ...rolData };
    } catch (error) {
      console.error('Error creando rol:', error);
      throw error;
    }
  }

  /**
   * Obtener rol por ID
   * @param {number} id - ID del rol
   * @returns {Object|null} - Rol encontrado o null
   */
  static async obtenerPorId(id) {
    try {
      const sql = 'SELECT * FROM roles WHERE id = ?';
      const roles = await query(sql, [id]);
      return roles.length > 0 ? roles[0] : null;
    } catch (error) {
      console.error('Error obteniendo rol por ID:', error);
      throw error;
    }
  }

  /**
   * Obtener rol por nombre
   * @param {string} nombre - Nombre del rol
   * @returns {Object|null} - Rol encontrado o null
   */
  static async obtenerPorNombre(nombre) {
    try {
      const sql = 'SELECT * FROM roles WHERE nombre = ?';
      const roles = await query(sql, [nombre]);
      return roles.length > 0 ? roles[0] : null;
    } catch (error) {
      console.error('Error obteniendo rol por nombre:', error);
      throw error;
    }
  }

  /**
   * Obtener todos los roles
   * @returns {Array} - Lista de roles
   */
  static async obtenerTodos() {
    try {
      const sql = 'SELECT * FROM roles ORDER BY nombre';
      const roles = await query(sql);
      return roles;
    } catch (error) {
      console.error('Error obteniendo roles:', error);
      throw error;
    }
  }

  /**
   * Actualizar rol
   * @param {number} id - ID del rol
   * @param {Object} rolData - Datos a actualizar
   * @returns {boolean} - True si se actualizó correctamente
   */
  static async actualizar(id, rolData) {
    try {
      const { nombre, descripcion } = rolData;
      const sql = 'UPDATE roles SET nombre = ?, descripcion = ? WHERE id = ?';
      const result = await query(sql, [nombre, descripcion, id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error actualizando rol:', error);
      throw error;
    }
  }

  /**
   * Eliminar rol
   * @param {number} id - ID del rol
   * @returns {boolean} - True si se eliminó correctamente
   */
  static async eliminar(id) {
    try {
      const sql = 'DELETE FROM roles WHERE id = ?';
      const result = await query(sql, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error eliminando rol:', error);
      throw error;
    }
  }

  /**
   * Verificar si existe un rol por nombre
   * @param {string} nombre - Nombre a verificar
   * @param {number} excludeId - ID a excluir (para actualizaciones)
   * @returns {boolean} - True si existe
   */
  static async existePorNombre(nombre, excludeId = null) {
    try {
      let sql = 'SELECT COUNT(*) as count FROM roles WHERE nombre = ?';
      const params = [nombre];

      if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
      }

      const result = await query(sql, params);
      return result[0].count > 0;
    } catch (error) {
      console.error('Error verificando existencia por nombre:', error);
      throw error;
    }
  }

  /**
   * Obtener roles con conteo de usuarios
   * @returns {Array} - Lista de roles con conteo de usuarios
   */
  static async obtenerConConteoUsuarios() {
    try {
      const sql = `
        SELECT r.*, COUNT(u.id) as total_usuarios
        FROM roles r
        LEFT JOIN usuarios u ON r.id = u.rol_id
        GROUP BY r.id
        ORDER BY r.nombre
      `;
      
      const roles = await query(sql);
      return roles;
    } catch (error) {
      console.error('Error obteniendo roles con conteo de usuarios:', error);
      throw error;
    }
  }

  /**
   * Obtener roles activos (con usuarios activos)
   * @returns {Array} - Lista de roles activos
   */
  static async obtenerActivos() {
    try {
      const sql = `
        SELECT DISTINCT r.*
        FROM roles r
        INNER JOIN usuarios u ON r.id = u.rol_id
        WHERE u.activo = 1
        ORDER BY r.nombre
      `;
      
      const roles = await query(sql);
      return roles;
    } catch (error) {
      console.error('Error obteniendo roles activos:', error);
      throw error;
    }
  }

  /**
   * Crear roles por defecto del sistema
   * @returns {Array} - Roles creados
   */
  static async crearRolesPorDefecto() {
    try {
      const rolesPorDefecto = [
        { nombre: 'administrador', descripcion: 'Acceso total al sistema' },
        { nombre: 'dueño', descripcion: 'Dueño del negocio con acceso a funciones de gestión' },
        { nombre: 'empleado', descripcion: 'Empleado con acceso limitado a sus funciones' },
        { nombre: 'cliente', descripcion: 'Cliente con acceso a servicios y citas' }
      ];

      const rolesCreados = [];

      for (const rol of rolesPorDefecto) {
        const existe = await this.existePorNombre(rol.nombre);
        if (!existe) {
          const rolCreado = await this.crear(rol);
          rolesCreados.push(rolCreado);
        }
      }

      return rolesCreados;
    } catch (error) {
      console.error('Error creando roles por defecto:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de roles
   * @returns {Object} - Estadísticas
   */
  static async obtenerEstadisticas() {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_roles,
          COUNT(DISTINCT u.rol_id) as roles_en_uso,
          COUNT(u.id) as total_usuarios_por_rol
        FROM roles r
        LEFT JOIN usuarios u ON r.id = u.rol_id AND u.activo = 1
        GROUP BY r.id
        ORDER BY total_usuarios_por_rol DESC
      `;

      const result = await query(sql);
      return result;
    } catch (error) {
      console.error('Error obteniendo estadísticas de roles:', error);
      throw error;
    }
  }

  /**
   * Buscar roles
   * @param {string} termino - Término de búsqueda
   * @returns {Array} - Lista de roles que coinciden
   */
  static async buscar(termino) {
    try {
      const sql = `
        SELECT r.*, COUNT(u.id) as total_usuarios
        FROM roles r
        LEFT JOIN usuarios u ON r.id = u.rol_id
        WHERE r.nombre LIKE ? OR r.descripcion LIKE ?
        GROUP BY r.id
        ORDER BY r.nombre
      `;

      const busqueda = `%${termino}%`;
      const roles = await query(sql, [busqueda, busqueda]);
      return roles;
    } catch (error) {
      console.error('Error buscando roles:', error);
      throw error;
    }
  }
}

module.exports = Rol; 