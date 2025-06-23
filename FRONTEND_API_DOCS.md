# 📄 Documentación de la API para el Frontend - Sistema de Barbería

¡Hola, equipo de frontend! 👋

Esta guía contiene todo lo que necesitas para integrar el sistema de autenticación y gestión de usuarios de la API de la barbería.

---

## 🚀 1. Puesta en Marcha del Backend

Para levantar el entorno de desarrollo del backend en tu máquina local, sigue estos pasos:

**1. Clona el repositorio (si aún no lo tienes):**
```bash
git clone <url_del_repositorio>
cd <nombre_del_repositorio>
```

**2. Instala las dependencias:**
```bash
npm install
```

**3. Configura tus variables de entorno:**
   - Crea una copia del archivo `env.example` y renómbrala a `.env`.
   - Rellena las variables de la base de datos, Firebase y JWT. **Tu compañero de backend debe proporcionarte las credenciales de Firebase**.
```bash
# Archivo .env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password_de_mysql
DB_NAME=peluqueria_db

# JWT - Puedes generar tus propias claves seguras
JWT_SECRET=un_secreto_muy_largo_y_seguro_para_el_access_token
JWT_REFRESH_SECRET=otro_secreto_diferente_muy_largo_y_seguro_para_el_refresh_token

# Firebase - Estas te las debe pasar el equipo de backend
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY_ID=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=...
FIREBASE_CLIENT_ID=...
```

**4. Inicia el servidor:**
```bash
npm run dev
```
> La API estará disponible en `http://localhost:5000`.

---

## 🔐 2. Flujo de Autenticación con Google

El sistema usa un flujo de autenticación 100% basado en Google. **No hay registro con email y contraseña**.

**Paso 1: (FRONTEND) Obtener el `idToken` de Google**
- Usa el SDK de Firebase para web en tu aplicación de frontend.
- Implementa el "Sign-in with Google" para que el usuario inicie sesión con su cuenta de Google.
- Cuando el inicio de sesión sea exitoso, Firebase te devolverá un `idToken`.

```javascript
// Ejemplo de cómo obtener el idToken en el frontend
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const auth = getAuth();
const provider = new GoogleAuthProvider();

signInWithPopup(auth, provider)
  .then((result) => {
    // ¡Éxito! Aquí tienes el token que necesitas.
    const idToken = await result.user.getIdToken();
    
    // Ahora envía este idToken a nuestro backend (Paso 2).
    loginConBackend(idToken);
  })
  .catch((error) => {
    console.error("Error en el login con Google:", error);
  });
```

**Paso 2: (FRONTEND -> BACKEND) Enviar `idToken` a la API**
- Llama al endpoint `POST /api/auth/login/google` de nuestro backend y envía el `idToken` en el cuerpo de la solicitud.

**Paso 3: (BACKEND -> FRONTEND) Recibir Tokens de Sesión**
- Si el `idToken` es válido, nuestro backend te devolverá un `accessToken` y un `refreshToken`.

**Paso 4: (FRONTEND) Almacenar los Tokens**
- **`accessToken`**: Guárdalo en memoria (ej. en una variable de estado de React Context o Redux). **No lo guardes en `localStorage`** por seguridad. Este token tiene una duración corta (24 horas).
- **`refreshToken`**: Guárdalo de forma más persistente, como en `localStorage` o una cookie `HttpOnly` segura. Este token se usa para obtener nuevos `accessToken` cuando expiren.

---

## Endpoints de la API

### Autenticación

#### `POST /api/auth/login/google`
Inicia sesión o registra a un usuario usando su `idToken` de Google.
- **Acceso:** Público
- **Cuerpo de la solicitud:**
  ```json
  {
    "idToken": "el_id_token_obtenido_de_firebase_auth_en_el_frontend"
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "usuario": {
      "id": 123,
      "firebase_uid": "...",
      "email": "usuario.nuevo@gmail.com",
      "nombre": "Usuario",
      "apellido": "Nuevo",
      "foto_perfil": "https://url.a.la.foto/de/perfil.jpg",
      "rol_id": 3,
      "rol_nombre": "cliente",
      "cliente_id": 45
      // ...otros datos del perfil
    },
    "tokens": {
      "accessToken": "ey...",
      "refreshToken": "ey..."
    },
    "mensaje": "Autenticación exitosa"
  }
  ```

#### `POST /api/auth/refresh`
Obtiene un nuevo `accessToken` usando un `refreshToken` válido.
- **Acceso:** Público
- **Cuerpo de la solicitud:**
  ```json
  {
    "refreshToken": "el_refresh_token_guardado"
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "tokens": {
      "accessToken": "un_nuevo_access_token",
      "refreshToken": "un_nuevo_refresh_token_si_se_rota"
    },
    "mensaje": "Token refrescado exitosamente"
  }
  ```

#### `POST /api/auth/logout`
Informa al backend que el usuario ha cerrado sesión (para fines de logging).
- **Acceso:** Privado (requiere `accessToken`)
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "mensaje": "Sesión cerrada exitosamente"
  }
  ```

### Gestión de Perfil

#### `GET /api/auth/profile`
Obtiene los datos del perfil del usuario actualmente autenticado.
- **Acceso:** Privado (requiere `accessToken`)
- **Respuesta Exitosa (200 OK):** (similar a la respuesta de login)
  ```json
  {
    "success": true,
    "usuario": { /* ...datos completos del usuario... */ }
  }
  ```

#### `PUT /api/auth/profile`
Actualiza los datos del perfil del usuario. Solo envía los campos que quieres modificar.
- **Acceso:** Privado (requiere `accessToken`)
- **Cuerpo de la solicitud (ejemplo):**
  ```json
  {
    "nombre": "Juan Carlos",
    "telefono": "+34123456789",
    "notificacion_push": true,
    "recordatorio_horas_antes": 48
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "usuario": { /* ...datos completos y actualizados del usuario... */ },
    "mensaje": "Perfil actualizado exitosamente"
  }
  ```

### Verificación y Estadísticas

#### `GET /api/auth/verify`
Verifica si el `accessToken` actual es válido y devuelve los datos del usuario. Útil para cargar el estado del usuario al iniciar la aplicación.
- **Acceso:** Privado (requiere `accessToken`)
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "autenticado": true,
    "usuario": { /* ...datos completos del usuario... */ }
  }
  ```

#### `GET /api/auth/stats`
Obtiene estadísticas de autenticación.
- **Acceso:** Privado (Solo para `rol_id` 1: administrador y 4: dueño)

### Servicios

#### `GET /api/servicios`
Obtiene una lista de todos los servicios. Permite filtros por query params (ver más abajo).
- **Acceso:** Público
- **Query params opcionales:**
  - `activo` (1 o 0)
  - `categoria_id` (ID de categoría)
  - `destacado` (1 o 0)
  - `requiere_cita` (1 o 0)
  - `busqueda` (string)
  - `precio_min`, `precio_max` (números)
  - `ordenar_por` (nombre, precio, duracion, categoria, destacado)
  - `limite`, `offset` (paginación)
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "count": 2,
    "data": [
      {
        "id": 1,
        "nombre": "Corte de Cabello",
        "descripcion": "Corte clásico o moderno...",
        "precio": 15,
        "duracion_minutos": 30,
        "categoria_id": 1,
        "categoria_nombre": "Cortes",
        "activo": 1,
        "destacado": 1,
        "requiere_cita": 1,
        "color_servicio": "#FFD700",
        "icono_servicio": "scissors"
      }
    ]
  }
  ```

#### `GET /api/servicios/:id`
Obtiene un servicio por su ID.
- **Acceso:** Público
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "nombre": "Corte de Cabello",
      // ...otros campos
    }
  }
  ```

#### `GET /api/servicios/categoria/:categoria_id`
Obtiene todos los servicios de una categoría específica.
- **Acceso:** Público
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "count": 1,
    "data": [ /* ...servicios... */ ]
  }
  ```

#### `GET /api/servicios/destacados`
Obtiene los servicios destacados (por defecto 10, configurable con `?limite=5`).
- **Acceso:** Público
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "count": 2,
    "data": [ /* ...servicios... */ ]
  }
  ```

#### `GET /api/servicios/buscar?q=palabra`
Busca servicios por nombre, descripción o categoría.
- **Acceso:** Público
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "count": 1,
    "data": [ /* ...servicios... */ ]
  }
  ```

#### `POST /api/servicios`
Crea un nuevo servicio.
- **Acceso:** Privado (requiere rol `administrador` o `dueño`)
- **Cuerpo de la solicitud:**
  ```json
  {
    "nombre": "Corte de Cabello",
    "descripcion": "Corte clásico o moderno...",
    "precio": 15,
    "duracion_minutos": 30,
    "categoria_id": 1,
    "imagen_url": "https://...",
    "activo": 1,
    "destacado": 1,
    "requiere_cita": 1,
    "color_servicio": "#FFD700",
    "icono_servicio": "scissors"
  }
  ```
- **Respuesta Exitosa (201 Created):**
  ```json
  {
    "success": true,
    "data": { /* ...servicio creado... */ }
  }
  ```

#### `PUT /api/servicios/:id`
Actualiza un servicio existente.
- **Acceso:** Privado (requiere rol `administrador` o `dueño`)
- **Cuerpo de la solicitud:** (solo los campos a modificar)
  ```json
  {
    "precio": 18,
    "destacado": 0
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "mensaje": "Servicio actualizado correctamente"
  }
  ```

#### `DELETE /api/servicios/:id`
Elimina (desactiva) un servicio.
- **Acceso:** Privado (requiere rol `administrador` o `dueño`)
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "mensaje": "Servicio eliminado correctamente"
  }
  ```

---

## 🔄 4. Gestión de Tokens y Sesiones

**1. Envío del `accessToken`:**
- Para todos los endpoints privados, debes incluir el `accessToken` en la cabecera `Authorization`.
  ```
  Authorization: Bearer <tu_accessToken>
  ```

**2. Manejo de Expiración del `accessToken`:**
- El `accessToken` expira en 24 horas. Cuando hagas una petición con un token expirado, la API te responderá con un error **`401 Unauthorized`**.
- Cuando esto ocurra, debes:
  1.  Llamar al endpoint `POST /api/auth/refresh` con tu `refreshToken`.
  2.  Recibirás nuevos tokens. Actualiza el `accessToken` en memoria y el `refreshToken` en `localStorage`.
  3.  Reintenta la petición original que había fallado, ahora con el nuevo `accessToken`.
- Este flujo es ideal para implementarlo en un interceptor de Axios o Fetch.

**3. Cierre de Sesión (Logout):**
- Llama al endpoint `POST /api/auth/logout`.
- En el frontend, elimina todos los tokens (`accessToken` y `refreshToken`) y redirige al usuario a la página de inicio de sesión.

---

## 🎭 5. Roles de Usuario

El perfil del usuario devuelto por la API incluye `rol_id` y `rol_nombre`. Puedes usar estos campos para controlar la interfaz de usuario.

- **`1`**: `administrador`
- **`2`**: `empleado`
- **`3`**: `cliente`
- **`4`**: `dueño`

**Ejemplo de uso en el frontend:**
```javascript
// Si el usuario tiene rol 'administrador' o 'dueño', muestra el dashboard de admin
{
  (usuario.rol_id === 1 || usuario.rol_id === 4) && <AdminDashboard />
}
```

---

## 👨‍💼 6. Gestión de Empleados
**Acceso:** Todas las rutas de este módulo requieren autenticación y rol de `administrador` o `dueño`.

### CRUD de Empleados
#### `POST /api/empleados`
Promueve a un usuario existente al rol de empleado, creando su perfil de empleado. Este proceso cambiará el rol del usuario y eliminará su perfil de cliente si existe.
- **Cuerpo de la solicitud:**
  ```json
  {
    "usuario_id": 123,
    "titulo": "Estilista Senior",
    "biografia": "Más de 10 años de experiencia...",
    "fecha_contratacion": "2024-01-15",
    "especialidades": [1, 3], 
    "servicios": [2, 5],
    "horarios": [
      { "dia_semana": 1, "hora_inicio": "09:00:00", "hora_fin": "18:00:00" },
      { "dia_semana": 2, "hora_inicio": "09:00:00", "hora_fin": "18:00:00" }
    ]
  }
  ```
- **Respuesta Exitosa (201 Created):** Devuelve el objeto completo del nuevo empleado.

#### `GET /api/empleados`
Obtiene una lista de todos los empleados activos.

#### `GET /api/empleados/:id`
Obtiene el perfil completo de un solo empleado, incluyendo sus especialidades, servicios, horarios y ausencias.

#### `PUT /api/empleados/:id`
Actualiza los datos principales de un empleado y su perfil de usuario.
- **Cuerpo de la solicitud:** (Envía solo los campos a modificar)
  ```json
  {
    "telefono": "+1122334455",
    "titulo": "Master Estilista",
    "activo": true
  }
  ```

#### `DELETE /api/empleados/:id`
Desactiva un empleado (soft delete). El empleado ya no podrá iniciar sesión ni aparecerá en las listas públicas.

### Especialidades, Servicios, Horarios y Ausencias

#### `POST /api/empleados/:id/especialidades`
Reemplaza completamente las especialidades de un empleado.
- **Cuerpo:** `{ "especialidades": [1, 2, 4] }` // Array de IDs de especialidad

#### `POST /api/empleados/:id/servicios`
Reemplaza completamente los servicios que realiza un empleado.
- **Cuerpo:** `{ "servicios": [1, 3] }` // Array de IDs de servicio

#### `POST /api/empleados/:id/horarios`
Reemplaza completamente el horario semanal de un empleado.
- **Cuerpo:** `{ "horarios": [ { "dia_semana": 1, "hora_inicio": "10:00", "hora_fin": "19:00" }, ... ] }`

#### `GET /api/empleados/:id/ausencias`
Obtiene una lista de todas las ausencias (pasadas y futuras) de un empleado.

#### `POST /api/empleados/:id/ausencias`
Añade una nueva ausencia para un empleado.
- **Cuerpo:**
  ```json
  {
    "fecha_inicio": "2024-12-24T09:00:00",
    "fecha_fin": "2024-12-26T18:00:00",
    "motivo": "Vacaciones",
    "descripcion": "Ausencia por festividades."
  }
  ```

#### `PUT /api/empleados/:id/ausencias/:ausenciaId`
Actualiza una ausencia existente.

#### `DELETE /api/empleados/:id/ausencias/:ausenciaId`
Elimina un registro de ausencia.

---

## ⚠️ 7. Manejo de Errores

La API utiliza códigos de estado HTTP estándar para comunicar errores.

- **`400 Bad Request`**: Error de validación en la solicitud. La respuesta incluirá un array de errores.
  ```json
  {
    "success": false,
    "errors": [
      {
        "type": "field",
        "value": "email-invalido",
        "msg": "Email debe tener un formato válido",
        "path": "email",
        "location": "body"
      }
    ]
  }
  ```
- **`401 Unauthorized`**: Token inválido, expirado o ausente. Debes usar el `refreshToken` para obtener uno nuevo.
- **`403 Forbidden`**: El usuario está autenticado, pero no tiene permisos para acceder a este recurso (ej. un cliente intentando acceder a un endpoint de admin).
- **`404 Not Found`**: El endpoint o el recurso solicitado no existe.
- **`500 Internal Server Error`**: Un error inesperado ocurrió en el servidor.

---

Si tienes alguna pregunta, ¡no dudes en consultar! 🚀