const { google } = require('googleapis');
const { query } = require('../config/database');

class GoogleCalendarService {
  constructor() {
    this.calendar = google.calendar({ version: 'v3' });
    this.auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });
  }

  async crearEventoCita(citaId) {
    try {
      console.log('📅 [googleCalendarService.crearEventoCita] Creando evento para cita:', citaId);
      
      // Verificar si las credenciales están configuradas
      if (!process.env.GOOGLE_CALENDAR_CLIENT_ID || !process.env.GOOGLE_CALENDAR_CLIENT_SECRET) {
        console.log('⚠️ [googleCalendarService.crearEventoCita] Credenciales de Google Calendar no configuradas');
        return null;
      }
      
      // Obtener información de la cita
      const citaSql = `
        SELECT 
          c.id,
          c.fecha_hora_inicio,
          c.fecha_hora_fin,
          CONCAT(u_cliente.nombre, ' ', u_cliente.apellido) as cliente_nombre,
          u_cliente.email as cliente_email,
          CONCAT(u_empleado.nombre, ' ', u_empleado.apellido) as empleado_nombre,
          u_empleado.email as empleado_email,
          GROUP_CONCAT(s.nombre SEPARATOR ', ') as servicios
        FROM citas c
        INNER JOIN clientes cl ON c.cliente_id = cl.id
        INNER JOIN usuarios u_cliente ON cl.usuario_id = u_cliente.id
        INNER JOIN empleados e ON c.empleado_id = e.id
        INNER JOIN usuarios u_empleado ON e.usuario_id = u_empleado.id
        INNER JOIN cita_servicio cs ON c.id = cs.cita_id
        INNER JOIN servicios s ON cs.servicio_id = s.id
        WHERE c.id = ?
        GROUP BY c.id
      `;
      
      const [cita] = await query(citaSql, [citaId]);
      
      if (!cita) {
        throw new Error('Cita no encontrada');
      }

      const event = {
        summary: `Cita - ${cita.cliente_nombre}`,
        description: `
          Servicios: ${cita.servicios}
          Barbero: ${cita.empleado_nombre}
          
          BarberShot - Tu estilo, nuestra pasión
        `,
        start: {
          dateTime: cita.fecha_hora_inicio.toISOString(),
          timeZone: 'America/Guayaquil',
        },
        end: {
          dateTime: cita.fecha_hora_fin.toISOString(),
          timeZone: 'America/Guayaquil',
        },
        attendees: [
          { email: cita.cliente_email },
          { email: cita.empleado_email }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 día antes
            { method: 'popup', minutes: 30 }, // 30 minutos antes
          ],
        },
        location: 'BarberShot - Dirección del local',
        colorId: '1' // Azul
      };

      const auth = await this.auth.getClient();
      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
      
      const response = await this.calendar.events.insert({
        auth: auth,
        calendarId: calendarId,
        resource: event,
        sendUpdates: 'all' // Enviar notificaciones a todos los asistentes
      });

      console.log('✅ [googleCalendarService.crearEventoCita] Evento creado exitosamente:', response.data.id);
      
      // Guardar el ID del evento en la base de datos
      await this.guardarEventoId(citaId, response.data.id);
      
      return response.data;
    } catch (error) {
      console.error('❌ [googleCalendarService.crearEventoCita] Error:', error);
      // No lanzar error, solo log
      return null;
    }
  }

  async actualizarEventoCita(citaId) {
    try {
      console.log('📅 [googleCalendarService.actualizarEventoCita] Actualizando evento para cita:', citaId);
      
      // Obtener el ID del evento de Google Calendar
      const eventoSql = 'SELECT google_event_id FROM citas WHERE id = ?';
      const [cita] = await query(eventoSql, [citaId]);
      
      if (!cita || !cita.google_event_id) {
        console.log('⚠️ [googleCalendarService.actualizarEventoCita] No se encontró evento de Google Calendar, creando uno nuevo');
        return await this.crearEventoCita(citaId);
      }

      // Obtener información actualizada de la cita
      const citaSql = `
        SELECT 
          c.id,
          c.fecha_hora_inicio,
          c.fecha_hora_fin,
          CONCAT(u_cliente.nombre, ' ', u_cliente.apellido) as cliente_nombre,
          u_cliente.email as cliente_email,
          CONCAT(u_empleado.nombre, ' ', u_empleado.apellido) as empleado_nombre,
          u_empleado.email as empleado_email,
          GROUP_CONCAT(s.nombre SEPARATOR ', ') as servicios
        FROM citas c
        INNER JOIN clientes cl ON c.cliente_id = cl.id
        INNER JOIN usuarios u_cliente ON cl.usuario_id = u_cliente.id
        INNER JOIN empleados e ON c.empleado_id = e.id
        INNER JOIN usuarios u_empleado ON e.usuario_id = u_empleado.id
        INNER JOIN cita_servicio cs ON c.id = cs.cita_id
        INNER JOIN servicios s ON cs.servicio_id = s.id
        WHERE c.id = ?
        GROUP BY c.id
      `;
      
      const [citaInfo] = await query(citaSql, [citaId]);
      
      if (!citaInfo) {
        throw new Error('Cita no encontrada');
      }

      const event = {
        summary: `Cita - ${citaInfo.cliente_nombre}`,
        description: `
          Servicios: ${citaInfo.servicios}
          Barbero: ${citaInfo.empleado_nombre}
          
          BarberShot - Tu estilo, nuestra pasión
        `,
        start: {
          dateTime: citaInfo.fecha_hora_inicio.toISOString(),
          timeZone: 'America/Guayaquil',
        },
        end: {
          dateTime: citaInfo.fecha_hora_fin.toISOString(),
          timeZone: 'America/Guayaquil',
        },
        attendees: [
          { email: citaInfo.cliente_email },
          { email: citaInfo.empleado_email }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 },
          ],
        },
        location: 'BarberShot - Dirección del local',
        colorId: '1'
      };

      const auth = await this.auth.getClient();
      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
      
      const response = await this.calendar.events.update({
        auth: auth,
        calendarId: calendarId,
        eventId: cita.google_event_id,
        resource: event,
        sendUpdates: 'all'
      });

      console.log('✅ [googleCalendarService.actualizarEventoCita] Evento actualizado exitosamente');
      
      return response.data;
    } catch (error) {
      console.error('❌ [googleCalendarService.actualizarEventoCita] Error:', error);
      throw error;
    }
  }

  async cancelarEventoCita(citaId) {
    try {
      console.log('📅 [googleCalendarService.cancelarEventoCita] Cancelando evento para cita:', citaId);
      
      // Obtener el ID del evento de Google Calendar
      const eventoSql = 'SELECT google_event_id FROM citas WHERE id = ?';
      const [cita] = await query(eventoSql, [citaId]);
      
      if (!cita || !cita.google_event_id) {
        console.log('⚠️ [googleCalendarService.cancelarEventoCita] No se encontró evento de Google Calendar');
        return;
      }

      const auth = await this.auth.getClient();
      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
      
      await this.calendar.events.delete({
        auth: auth,
        calendarId: calendarId,
        eventId: cita.google_event_id,
        sendUpdates: 'all'
      });

      console.log('✅ [googleCalendarService.cancelarEventoCita] Evento cancelado exitosamente');
      
      // Limpiar el ID del evento en la base de datos
      await this.limpiarEventoId(citaId);
      
    } catch (error) {
      console.error('❌ [googleCalendarService.cancelarEventoCita] Error:', error);
      throw error;
    }
  }

  async guardarEventoId(citaId, eventoId) {
    try {
      await query('UPDATE citas SET google_event_id = ? WHERE id = ?', [eventoId, citaId]);
      console.log('✅ [googleCalendarService.guardarEventoId] ID de evento guardado');
    } catch (error) {
      console.error('❌ [googleCalendarService.guardarEventoId] Error:', error);
    }
  }

  async limpiarEventoId(citaId) {
    try {
      await query('UPDATE citas SET google_event_id = NULL WHERE id = ?', [citaId]);
      console.log('✅ [googleCalendarService.limpiarEventoId] ID de evento limpiado');
    } catch (error) {
      console.error('❌ [googleCalendarService.limpiarEventoId] Error:', error);
    }
  }
}

module.exports = new GoogleCalendarService(); 