const { admin } = require('../config/firebaseAdmin');
const pool = require('../config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const Cliente = require('../models/Cliente');
const Empleado = require('../models/Empleado');
const Log = require('../models/Log');

class AuthService {
  constructor() {
    this.maxLoginAttempts = 10;
    this.sessionExpiry = 24 * 60 * 60 * 1000; // 24 horas
    this.refreshExpiry = 7 * 24 * 60 * 60 * 1000; // 7 días
    this.maxDevices = 3;
  }

  /**
   * Autenticación principal con Google OAuth
   * @param {string} idToken - Token de ID de Google
   * @param {string} userAgent - User agent del dispositivo
   * @param {string} ip - IP del cliente
   * @returns {Object} - Datos del usuario autenticado y tokens
   */
  async loginGoogle(idToken, userAgent, ip) {
    try {
      // 1. Validar token de Google
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      
      // 2. Buscar o crear usuario en la base de datos
      let usuario = await this.buscarUsuarioPorFirebaseUid(decodedToken.uid);
      
      if (!usuario) {
        usuario = await this.crearUsuarioDesdeGoogle(decodedToken);
      } else {
        // Actualizar último acceso
        await this.actualizarUltimoAcceso(usuario.id);
      }
      
      // 3. Verificar si el usuario está activo
      if (!usuario.activo) {
        throw new Error('Usuario inactivo. Contacte al administrador.');
      }
      
      // 4. Generar tokens JWT
      const tokens = await this.generarTokens(usuario);
      
      // 5. Registrar log de auditoría
      await this.registrarLog(usuario.id, 'LOGIN_GOOGLE', 'usuarios', usuario.id, {
        email: usuario.email,
        userAgent,
        ip
      });
      
      // 6. Obtener datos completos del usuario
      const datosCompletos = await this.obtenerDatosCompletos(usuario.id);
      
      return {
        success: true,
        usuario: datosCompletos,
        tokens,
        mensaje: 'Autenticación exitosa'
      };
      
    } catch (error) {
      console.error('Error en loginGoogle:', error);
      throw new Error(`Error de autenticación: ${error.message}`);
    }
  }

  /**
   * Buscar usuario por Firebase UID
   */
  async buscarUsuarioPorFirebaseUid(firebaseUid) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM usuarios WHERE firebase_uid = ?',
        [firebaseUid]
      );
      return rows[0] || null;
    } catch (error) {
      throw new Error(`Error buscando usuario: ${error.message}`);
    }
  }

  /**
   * Crear nuevo usuario desde datos de Google
   */
  async crearUsuarioDesdeGoogle(decodedToken) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Asignar rol de "cliente" (id=3) por defecto a todos los nuevos usuarios.
      const rolId = 3;
      
      // Crear usuario con las columnas que realmente existen
      const [result] = await connection.execute(
        `INSERT INTO usuarios (firebase_uid, email, nombre, apellido, foto_perfil, rol_id, activo) 
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          decodedToken.uid,
          decodedToken.email,
          decodedToken.name?.split(' ')[0] || '',
          decodedToken.name?.split(' ').slice(1).join(' ') || '',
          decodedToken.picture || null,
          rolId
        ]
      );
      
      const usuarioId = result.insertId;
      
      // Como es un nuevo usuario, siempre será cliente, así que creamos su perfil.
      await connection.execute(
        'INSERT INTO clientes (usuario_id) VALUES (?)',
        [usuarioId]
      );
      
      await connection.commit();
      
      // Obtener usuario creado
      const [rows] = await connection.execute(
        'SELECT * FROM usuarios WHERE id = ?',
        [usuarioId]
      );
      
      return rows[0];
      
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error creando usuario: ${error.message}`);
    } finally {
      connection.release();
    }
  }

  /**
   * Generar tokens JWT
   */
  async generarTokens(usuario) {
    const payload = {
      id: usuario.id,
      email: usuario.email,
      rol_id: usuario.rol_id,
      firebase_uid: usuario.firebase_uid
    };
    
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });
    
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: '7d'
    });
    
    return { accessToken, refreshToken };
  }

  /**
   * Actualizar último acceso
   */
  async actualizarUltimoAcceso(usuarioId) {
    await pool.execute(
      'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?',
      [usuarioId]
    );
  }

  /**
   * Obtener datos completos del usuario
   */
  async obtenerDatosCompletos(usuarioId) {
    try {
      const [rows] = await pool.execute(
        `SELECT u.*, r.nombre as rol_nombre, 
                c.id as cliente_id, c.fecha_nacimiento, c.genero, c.notas_preferencias,
                e.id as empleado_id, e.titulo, e.biografia, e.fecha_contratacion
         FROM usuarios u
         LEFT JOIN roles r ON u.rol_id = r.id
         LEFT JOIN clientes c ON u.id = c.usuario_id
         LEFT JOIN empleados e ON u.id = e.usuario_id
         WHERE u.id = ?`,
        [usuarioId]
      );
      
      return rows[0];
    } catch (error) {
      throw new Error(`Error obteniendo datos completos: ${error.message}`);
    }
  }

  /**
   * Validar token JWT
   */
  async validarToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Verificar si el usuario sigue activo
      const [rows] = await pool.execute(
        'SELECT id, activo FROM usuarios WHERE id = ?',
        [decoded.id]
      );
      
      if (!rows[0] || !rows[0].activo) {
        throw new Error('Usuario inactivo');
      }
      
      return decoded;
    } catch (error) {
      throw new Error('Token inválido');
    }
  }

  /**
   * Refrescar token
   */
  async refrescarToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      // Obtener usuario
      const [usuarioRows] = await pool.execute(
        'SELECT * FROM usuarios WHERE id = ? AND activo = 1',
        [decoded.id]
      );
      
      if (!usuarioRows[0]) {
        throw new Error('Usuario no encontrado o inactivo');
      }
      
      // Generar nuevos tokens
      const tokens = await this.generarTokens(usuarioRows[0]);
      
      return tokens;
    } catch (error) {
      throw new Error('Error refrescando token');
    }
  }

  /**
   * Registrar log de auditoría
   */
  async registrarLog(usuarioId, accion, tabla, registroId, detalles) {
    try {
      const log = new Log();
      await log.create({
        usuario_id: usuarioId,
        accion,
        tabla_afectada: tabla,
        registro_id: registroId,
        detalles: JSON.stringify(detalles),
        ip: detalles.ip || null,
        user_agent: detalles.userAgent || null
      });
    } catch (error) {
      console.error('Error registrando log:', error);
    }
  }

  /**
   * Actualizar perfil del usuario
   */
  async actualizarPerfil(usuarioId, datosPerfil) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Actualizar datos básicos del usuario
      const camposUsuario = [];
      const valoresUsuario = [];
      
      if (datosPerfil.nombre !== undefined) {
        camposUsuario.push('nombre = ?');
        valoresUsuario.push(datosPerfil.nombre);
      }
      
      if (datosPerfil.apellido !== undefined) {
        camposUsuario.push('apellido = ?');
        valoresUsuario.push(datosPerfil.apellido);
      }
      
      if (datosPerfil.telefono !== undefined) {
        camposUsuario.push('telefono = ?');
        valoresUsuario.push(datosPerfil.telefono);
      }
      
      if (datosPerfil.foto_perfil !== undefined) {
        camposUsuario.push('foto_perfil = ?');
        valoresUsuario.push(datosPerfil.foto_perfil);
      }
      
      if (datosPerfil.notificacion_correo !== undefined) {
        camposUsuario.push('notificacion_correo = ?');
        valoresUsuario.push(datosPerfil.notificacion_correo);
      }
      
      if (datosPerfil.notificacion_push !== undefined) {
        camposUsuario.push('notificacion_push = ?');
        valoresUsuario.push(datosPerfil.notificacion_push);
      }
      
      if (datosPerfil.notificacion_sms !== undefined) {
        camposUsuario.push('notificacion_sms = ?');
        valoresUsuario.push(datosPerfil.notificacion_sms);
      }
      
      if (datosPerfil.recordatorio_horas_antes !== undefined) {
        camposUsuario.push('recordatorio_horas_antes = ?');
        valoresUsuario.push(datosPerfil.recordatorio_horas_antes);
      }
      
      if (camposUsuario.length > 0) {
        camposUsuario.push('updated_at = NOW()');
        valoresUsuario.push(usuarioId);
        
        await connection.execute(
          `UPDATE usuarios SET ${camposUsuario.join(', ')} WHERE id = ?`,
          valoresUsuario
        );
      }
      
      // Si es cliente, actualizar datos adicionales
      if (datosPerfil.fecha_nacimiento || datosPerfil.genero || datosPerfil.notas_preferencias) {
        const camposCliente = [];
        const valoresCliente = [];
        
        if (datosPerfil.fecha_nacimiento !== undefined) {
          camposCliente.push('fecha_nacimiento = ?');
          valoresCliente.push(datosPerfil.fecha_nacimiento);
        }
        
        if (datosPerfil.genero !== undefined) {
          camposCliente.push('genero = ?');
          valoresCliente.push(datosPerfil.genero);
        }
        
        if (datosPerfil.notas_preferencias !== undefined) {
          camposCliente.push('notas_preferencias = ?');
          valoresCliente.push(datosPerfil.notas_preferencias);
        }
        
        if (camposCliente.length > 0) {
          camposCliente.push('updated_at = NOW()');
          valoresCliente.push(usuarioId);
          
          await connection.execute(
            `UPDATE clientes SET ${camposCliente.join(', ')} WHERE usuario_id = ?`,
            valoresCliente
          );
        }
      }
      
      await connection.commit();
      
      await this.registrarLog(usuarioId, 'ACTUALIZAR_PERFIL', 'usuarios', usuarioId, {
        accion: 'Perfil actualizado',
        campos_modificados: Object.keys(datosPerfil)
      });
      
      // Obtener datos actualizados
      const datosCompletos = await this.obtenerDatosCompletos(usuarioId);
      
      return datosCompletos;
      
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error actualizando perfil: ${error.message}`);
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener estadísticas de autenticación (solo admin)
   */
  async obtenerEstadisticas() {
    try {
      const [usuariosActivos] = await pool.execute(
        'SELECT COUNT(*) as total FROM usuarios WHERE activo = 1'
      );

      const [loginsHoy] = await pool.execute(
        'SELECT COUNT(*) as total FROM logs WHERE accion = "LOGIN_GOOGLE" AND DATE(created_at) = CURDATE()'
      );

      const [usuariosPorRol] = await pool.execute(
        `SELECT r.nombre as rol, COUNT(u.id) as total 
         FROM roles r 
         LEFT JOIN usuarios u ON r.id = u.rol_id AND u.activo = 1 
         GROUP BY r.id, r.nombre`
      );

      const [ultimosRegistros] = await pool.execute(
        `SELECT u.email, u.nombre, u.apellido, u.fecha_registro, r.nombre as rol
         FROM usuarios u
         JOIN roles r ON u.rol_id = r.id
         ORDER BY u.fecha_registro DESC
         LIMIT 10`
      );

      return {
        usuariosActivos: usuariosActivos[0].total,
        loginsHoy: loginsHoy[0].total,
        usuariosPorRol,
        ultimosRegistros
      };
    } catch (error) {
      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }
  }
}

module.exports = new AuthService(); 