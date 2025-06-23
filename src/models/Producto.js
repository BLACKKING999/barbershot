const pool = require('../config/database');

/**
 * Modelo para la gestión de productos
 * Maneja operaciones CRUD, búsquedas, filtros y estadísticas de productos
 */
class Producto {
  /**
   * Crear un nuevo producto
   * @param {Object} producto - Datos del producto
   * @returns {Promise<Object>} Producto creado
   */
  static async crear(producto) {
    const {
      categoria_id,
      nombre,
      descripcion,
      marca,
      precio_compra,
      precio_venta,
      stock,
      stock_minimo,
      codigo_barras,
      imagen,
      activo = 1
    } = producto;

    const query = `
      INSERT INTO productos (
        categoria_id, nombre, descripcion, marca, precio_compra, 
        precio_venta, stock, stock_minimo, codigo_barras, imagen, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const [result] = await pool.execute(query, [
        categoria_id, nombre, descripcion, marca, precio_compra,
        precio_venta, stock, stock_minimo, codigo_barras, imagen, activo
      ]);

      return this.obtenerPorId(result.insertId);
    } catch (error) {
      throw new Error(`Error al crear producto: ${error.message}`);
    }
  }

  /**
   * Obtener producto por ID
   * @param {number} id - ID del producto
   * @returns {Promise<Object|null>} Producto encontrado
   */
  static async obtenerPorId(id) {
    const query = `
      SELECT p.*, cp.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE p.id = ?
    `;

    try {
      const [rows] = await pool.execute(query, [id]);
      return rows[0] || null;
    } catch (error) {
      throw new Error(`Error al obtener producto: ${error.message}`);
    }
  }

  /**
   * Obtener todos los productos con paginación
   * @param {Object} opciones - Opciones de paginación y filtros
   * @returns {Promise<Object>} Lista de productos y metadatos
   */
  static async obtenerTodos(opciones = {}) {
    const {
      pagina = 1,
      limite = 10,
      activo = null,
      categoria_id = null,
      busqueda = null,
      orden = 'nombre',
      direccion = 'ASC'
    } = opciones;

    let whereConditions = [];
    let params = [];

    if (activo !== null) {
      whereConditions.push('p.activo = ?');
      params.push(activo);
    }

    if (categoria_id) {
      whereConditions.push('p.categoria_id = ?');
      params.push(categoria_id);
    }

    if (busqueda) {
      whereConditions.push('(p.nombre LIKE ? OR p.descripcion LIKE ? OR p.marca LIKE ? OR p.codigo_barras LIKE ?)');
      const busquedaParam = `%${busqueda}%`;
      params.push(busquedaParam, busquedaParam, busquedaParam, busquedaParam);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const offset = (pagina - 1) * limite;
    const query = `
      SELECT p.*, cp.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      ${whereClause}
      ORDER BY p.${orden} ${direccion}
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM productos p
      ${whereClause}
    `;

    try {
      const [rows] = await pool.execute(query, [...params, limite, offset]);
      const [countResult] = await pool.execute(countQuery, params);

      return {
        productos: rows,
        paginacion: {
          pagina,
          limite,
          total: countResult[0].total,
          totalPaginas: Math.ceil(countResult[0].total / limite)
        }
      };
    } catch (error) {
      throw new Error(`Error al obtener productos: ${error.message}`);
    }
  }

  /**
   * Actualizar producto
   * @param {number} id - ID del producto
   * @param {Object} datos - Datos a actualizar
   * @returns {Promise<Object>} Producto actualizado
   */
  static async actualizar(id, datos) {
    const camposPermitidos = [
      'categoria_id', 'nombre', 'descripcion', 'marca', 'precio_compra',
      'precio_venta', 'stock', 'stock_minimo', 'codigo_barras', 'imagen', 'activo'
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
      UPDATE productos 
      SET ${camposActualizar.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    try {
      const [result] = await pool.execute(query, valores);
      
      if (result.affectedRows === 0) {
        throw new Error('Producto no encontrado');
      }

      return this.obtenerPorId(id);
    } catch (error) {
      throw new Error(`Error al actualizar producto: ${error.message}`);
    }
  }

  /**
   * Eliminar producto (marcar como inactivo)
   * @param {number} id - ID del producto
   * @returns {Promise<boolean>} Resultado de la operación
   */
  static async eliminar(id) {
    const query = 'UPDATE productos SET activo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?';

    try {
      const [result] = await pool.execute(query, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error al eliminar producto: ${error.message}`);
    }
  }

  /**
   * Buscar productos por nombre o descripción
   * @param {string} termino - Término de búsqueda
   * @param {number} limite - Límite de resultados
   * @returns {Promise<Array>} Productos encontrados
   */
  static async buscar(termino, limite = 10) {
    const query = `
      SELECT p.*, cp.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE p.activo = 1 
        AND (p.nombre LIKE ? OR p.descripcion LIKE ? OR p.marca LIKE ?)
      ORDER BY p.nombre
      LIMIT ?
    `;

    const busquedaParam = `%${termino}%`;

    try {
      const [rows] = await pool.execute(query, [busquedaParam, busquedaParam, busquedaParam, limite]);
      return rows;
    } catch (error) {
      throw new Error(`Error al buscar productos: ${error.message}`);
    }
  }

  /**
   * Obtener productos por categoría
   * @param {number} categoria_id - ID de la categoría
   * @param {Object} opciones - Opciones adicionales
   * @returns {Promise<Array>} Productos de la categoría
   */
  static async obtenerPorCategoria(categoria_id, opciones = {}) {
    const { activo = 1, orden = 'nombre' } = opciones;

    const query = `
      SELECT p.*, cp.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE p.categoria_id = ? AND p.activo = ?
      ORDER BY p.${orden}
    `;

    try {
      const [rows] = await pool.execute(query, [categoria_id, activo]);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener productos por categoría: ${error.message}`);
    }
  }

  /**
   * Obtener productos con stock bajo
   * @param {number} limite - Límite de resultados
   * @returns {Promise<Array>} Productos con stock bajo
   */
  static async obtenerStockBajo(limite = 20) {
    const query = `
      SELECT p.*, cp.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE p.activo = 1 AND p.stock <= p.stock_minimo
      ORDER BY p.stock ASC
      LIMIT ?
    `;

    try {
      const [rows] = await pool.execute(query, [limite]);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener productos con stock bajo: ${error.message}`);
    }
  }

  /**
   * Actualizar stock de producto
   * @param {number} id - ID del producto
   * @param {number} cantidad - Cantidad a sumar/restar (negativo para restar)
   * @returns {Promise<Object>} Producto actualizado
   */
  static async actualizarStock(id, cantidad) {
    const query = `
      UPDATE productos 
      SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND activo = 1
    `;

    try {
      const [result] = await pool.execute(query, [cantidad, id]);
      
      if (result.affectedRows === 0) {
        throw new Error('Producto no encontrado o inactivo');
      }

      return this.obtenerPorId(id);
    } catch (error) {
      throw new Error(`Error al actualizar stock: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de productos
   * @returns {Promise<Object>} Estadísticas generales
   */
  static async obtenerEstadisticas() {
    const query = `
      SELECT 
        COUNT(*) as total_productos,
        COUNT(CASE WHEN activo = 1 THEN 1 END) as productos_activos,
        COUNT(CASE WHEN stock <= stock_minimo THEN 1 END) as productos_stock_bajo,
        SUM(stock) as stock_total,
        SUM(precio_venta * stock) as valor_inventario,
        AVG(precio_venta) as precio_promedio
      FROM productos
    `;

    try {
      const [rows] = await pool.execute(query);
      return rows[0];
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  }

  /**
   * Obtener productos más vendidos
   * @param {number} limite - Límite de resultados
   * @param {string} periodo - Período de análisis (dias)
   * @returns {Promise<Array>} Productos más vendidos
   */
  static async obtenerMasVendidos(limite = 10, periodo = 30) {
    const query = `
      SELECT 
        p.id,
        p.nombre,
        p.marca,
        p.precio_venta,
        SUM(dvp.cantidad) as total_vendido,
        SUM(dvp.subtotal) as ingresos_totales
      FROM productos p
      JOIN detalle_venta_producto dvp ON p.id = dvp.producto_id
      JOIN ventas_productos vp ON dvp.venta_id = vp.id
      WHERE p.activo = 1 
        AND vp.fecha_venta >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY p.id
      ORDER BY total_vendido DESC
      LIMIT ?
    `;

    try {
      const [rows] = await pool.execute(query, [periodo, limite]);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener productos más vendidos: ${error.message}`);
    }
  }

  /**
   * Obtener historial de ventas de un producto
   * @param {number} producto_id - ID del producto
   * @param {Object} opciones - Opciones de filtrado
   * @returns {Promise<Array>} Historial de ventas
   */
  static async obtenerHistorialVentas(producto_id, opciones = {}) {
    const { limite = 50, fecha_inicio = null, fecha_fin = null } = opciones;

    let whereConditions = ['dvp.producto_id = ?'];
    let params = [producto_id];

    if (fecha_inicio) {
      whereConditions.push('vp.fecha_venta >= ?');
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereConditions.push('vp.fecha_venta <= ?');
      params.push(fecha_fin);
    }

    const query = `
      SELECT 
        vp.id as venta_id,
        vp.fecha_venta,
        dvp.cantidad,
        dvp.precio_unitario,
        dvp.subtotal,
        CONCAT(u.nombre, ' ', u.apellido) as cliente_nombre,
        CONCAT(emp.nombre, ' ', emp.apellido) as empleado_nombre
      FROM detalle_venta_producto dvp
      JOIN ventas_productos vp ON dvp.venta_id = vp.id
      LEFT JOIN clientes c ON vp.cliente_id = c.id
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      JOIN empleados e ON vp.empleado_id = e.id
      JOIN usuarios emp ON e.usuario_id = emp.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY vp.fecha_venta DESC
      LIMIT ?
    `;

    try {
      const [rows] = await pool.execute(query, [...params, limite]);
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener historial de ventas: ${error.message}`);
    }
  }

  /**
   * Verificar disponibilidad de stock
   * @param {number} producto_id - ID del producto
   * @param {number} cantidad - Cantidad requerida
   * @returns {Promise<boolean>} Disponibilidad
   */
  static async verificarDisponibilidad(producto_id, cantidad) {
    const query = 'SELECT stock FROM productos WHERE id = ? AND activo = 1';

    try {
      const [rows] = await pool.execute(query, [producto_id]);
      
      if (rows.length === 0) {
        return false;
      }

      return rows[0].stock >= cantidad;
    } catch (error) {
      throw new Error(`Error al verificar disponibilidad: ${error.message}`);
    }
  }

  /**
   * Obtener productos por código de barras
   * @param {string} codigo_barras - Código de barras
   * @returns {Promise<Object|null>} Producto encontrado
   */
  static async obtenerPorCodigoBarras(codigo_barras) {
    const query = `
      SELECT p.*, cp.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE p.codigo_barras = ? AND p.activo = 1
    `;

    try {
      const [rows] = await pool.execute(query, [codigo_barras]);
      return rows[0] || null;
    } catch (error) {
      throw new Error(`Error al obtener producto por código de barras: ${error.message}`);
    }
  }
}

module.exports = Producto; 