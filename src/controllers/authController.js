const authService = require('../services/authService');
const { validationResult } = require('express-validator');

class AuthController {
  /**
   * Login con Google OAuth
   * POST /api/auth/login/google
   */
  async loginGoogle(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { idToken } = req.body;
      const userAgent = req.get('User-Agent');
      const ip = req.ip || req.connection.remoteAddress;

      const result = await authService.loginGoogle(idToken, userAgent, ip);

      res.status(200).json(result);
    } catch (error) {
      console.error('Error en loginGoogle controller:', error);
      res.status(401).json({
        success: false,
        mensaje: error.message
      });
    }
  }

  /**
   * Refrescar token
   * POST /api/auth/refresh
   */
  async refrescarToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          mensaje: 'Refresh token requerido'
        });
      }

      const tokens = await authService.refrescarToken(refreshToken);

      res.status(200).json({
        success: true,
        tokens,
        mensaje: 'Token refrescado exitosamente'
      });
    } catch (error) {
      console.error('Error refrescando token:', error);
      res.status(401).json({
        success: false,
        mensaje: error.message
      });
    }
  }

  /**
   * Obtener perfil del usuario autenticado
   * GET /api/auth/profile
   */
  async obtenerPerfil(req, res) {
    try {
      const usuarioId = req.usuario.id;
      const datosCompletos = await authService.obtenerDatosCompletos(usuarioId);

      res.status(200).json({
        success: true,
        usuario: datosCompletos
      });
    } catch (error) {
      console.error('Error obteniendo perfil:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error obteniendo perfil'
      });
    }
  }

  /**
   * Actualizar perfil del usuario
   * PUT /api/auth/profile
   */
  async actualizarPerfil(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const usuarioId = req.usuario.id;
      const datosPerfil = req.body;

      const usuarioActualizado = await authService.actualizarPerfil(usuarioId, datosPerfil);

      res.status(200).json({
        success: true,
        usuario: usuarioActualizado,
        mensaje: 'Perfil actualizado exitosamente'
      });
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error actualizando perfil'
      });
    }
  }

  /**
   * Verificar estado de autenticación
   * GET /api/auth/verify
   */
  async verificarAutenticacion(req, res) {
    try {
      const usuarioId = req.usuario.id;
      const datosCompletos = await authService.obtenerDatosCompletos(usuarioId);

      res.status(200).json({
        success: true,
        autenticado: true,
        usuario: datosCompletos
      });
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      res.status(401).json({
        success: false,
        autenticado: false,
        mensaje: 'Token inválido'
      });
    }
  }

  /**
   * Obtener estadísticas de autenticación (solo admin)
   * GET /api/auth/stats
   */
  async obtenerEstadisticas(req, res) {
    try {
      // Verificar que sea admin
      if (req.usuario.rol_id !== 3) {
        return res.status(403).json({
          success: false,
          mensaje: 'Acceso denegado'
        });
      }

      const estadisticas = await authService.obtenerEstadisticas();

      res.status(200).json({
        success: true,
        estadisticas
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error obteniendo estadísticas'
      });
    }
  }

  /**
   * Logout simple (sin gestión de sesiones)
   * POST /api/auth/logout
   */
  async cerrarSesion(req, res) {
    try {
      const usuarioId = req.usuario.id;

      await authService.registrarLog(usuarioId, 'LOGOUT', 'usuarios', usuarioId, {
        accion: 'Sesión cerrada exitosamente'
      });

      res.status(200).json({
        success: true,
        mensaje: 'Sesión cerrada exitosamente'
      });
    } catch (error) {
      console.error('Error cerrando sesión:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error cerrando sesión'
      });
    }
  }
}

module.exports = new AuthController(); 