import sqlite3
from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS
import json
import datetime
import csv
from io import StringIO

# CONFIGURACIÓN DE FLASK
app = Flask(__name__, static_folder='.', static_url_path='/')
# Habilita CORS para todas las rutas /api/*
CORS(app, resources={r"/api/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE"]}}) 

DATABASE = 'inventario.db'

# --------------------------------------------------------------------------------
# RUTA PRINCIPAL (FRONTEND)
# --------------------------------------------------------------------------------
@app.route('/')
def index():
    """Sirve el archivo index.html desde el directorio actual."""
    return send_from_directory(app.static_folder, 'index.html')


# --------------------------------------------------------------------------------
# UTILIDADES DE BASE DE DATOS
# --------------------------------------------------------------------------------

def get_db_connection():
    """Establece una conexión a la base de datos y configura el row_factory."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def setup_database():
    """Inicializa la base de datos creando tablas si no existen y poblando datos."""
    conn = get_db_connection()

    # 1. Tabla de Categorías
    conn.execute("""
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE
        );
    """)

    # 2. Tabla de Artículos (Platos/Productos)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS articulos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            precio REAL NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0,
            categoria_id INTEGER,
            FOREIGN KEY (categoria_id) REFERENCES categorias(id)
        );
    """)

    # 3. Tabla de Mesas (Proveedores renombrados a Mesas)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS proveedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            descripcion TEXT
        );
    """)

    # 4. Tabla de Pedidos
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT NOT NULL,
            proveedor_id INTEGER, -- Usamos proveedor_id para referenciar la mesa
            total REAL NOT NULL,
            estado TEXT NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, EN PREPARACION, COMPLETADO, CANCELADO
            FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
        );
    """)

    # 5. Tabla de Ítems del Pedido
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pedido_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_pedido INTEGER NOT NULL,
            articulo_id INTEGER,
            nombre TEXT NOT NULL,
            cantidad INTEGER NOT NULL,
            precio REAL NOT NULL,
            FOREIGN KEY (id_pedido) REFERENCES pedidos(id),
            FOREIGN KEY (articulo_id) REFERENCES articulos(id)
        );
    """)
    
    # ---------------------------------------------------------------------
    # POBLAMIENTO DE DATOS (NUEVO MENÚ)
    # ---------------------------------------------------------------------
    
    # Eliminamos datos existentes en estas tablas para que el menú se cargue limpio 
    # cada vez que se ejecute la función. Cuidado si ya tienes datos reales.
    conn.execute("DELETE FROM articulos")
    conn.execute("DELETE FROM categorias")
    
    # 1. Poblar Categorías
    categorias_data = [
        (1, 'Pollos 🍗'),
        (2, 'Combos Personales 🍽️'),
        (3, 'Guarniciones 🍟'),
        (4, 'Bebidas 🥤'),
        (5, 'Salsas y Extras 🌶️'),
        (6, 'Extras de Pollo 🍖'),
        (7, 'Postres 🍰')
    ]
    # Usamos INSERT OR REPLACE para usar IDs fijas, ideal para referencias en desarrollo
    for id, nombre in categorias_data:
        conn.execute("INSERT OR REPLACE INTO categorias (id, nombre) VALUES (?, ?)", (id, nombre))


    # 2. Poblar Proveedores (Mesas)
    if not conn.execute("SELECT 1 FROM proveedores").fetchone():
        conn.execute("INSERT INTO proveedores (nombre) VALUES ('Mesa 1'), ('Mesa 2'), ('Mesa 3'), ('Mesa Delivery')")

    # 3. Poblar Artículos (Platos/Productos)
    articulos_data = [
        # CATEGORÍA 1: Pollos
        ('Pollo entero', 45.00, 100, 1),
        ('1/2 Pollo', 25.00, 100, 1),
        ('1/4 Pollo', 15.00, 100, 1),
        ('1/8 Pollo (presa)', 8.00, 100, 1),
        
        # CATEGORÍA 2: Combos Personales
        ('Combo Personal 1/4 (Papas/Ensalada)', 18.00, 50, 2),
        ('Combo Personal 1/2 (Papas/Ensalada/Gaseosa)', 28.00, 50, 2),
        ('Combo Familiar', 55.00, 30, 2),
        ('Combo Pareja', 35.00, 40, 2),
        
        # CATEGORÍA 3: Guarniciones
        ('Papas fritas personales', 8.00, 200, 3),
        ('Papas fritas medianas', 12.00, 150, 3),
        ('Papas fritas grandes', 18.00, 100, 3),
        ('Ensalada personal', 5.00, 100, 3),
        ('Ensalada mediana', 8.00, 100, 3),
        ('Ensalada grande', 12.00, 100, 3),
        ('Arroz chaufa personal', 12.00, 80, 3),
        ('Arroz chaufa mediano', 18.00, 60, 3),
        ('Yucas fritas', 10.00, 100, 3),
        ('Camote frito', 8.00, 100, 3),
        
        # CATEGORÍA 4: Bebidas
        ('Gaseosa personal 500ml', 5.00, 150, 4),
        ('Gaseosa 1L', 8.00, 100, 4),
        ('Gaseosa 1.5L', 10.00, 80, 4),
        ('Gaseosa 2L', 12.00, 50, 4),
        ('Chicha morada personal', 5.00, 100, 4),
        ('Chicha morada jarra', 12.00, 50, 4),
        ('Inka Kola 500ml', 5.50, 100, 4),
        ('Agua mineral', 3.00, 200, 4),
        
        # CATEGORÍA 5: Salsas y Extras
        ('Salsa criolla', 2.00, 300, 5),
        ('Ají especial de la casa', 3.00, 300, 5),
        ('Mayonesa', 2.00, 300, 5),
        ('Ketchup', 2.00, 300, 5),
        ('Mostaza', 2.00, 300, 5),
        ('Cremas especiales', 4.00, 200, 5),
        
        # CATEGORÍA 6: Extras de Pollo
        ('Alitas (6 unidades)', 18.00, 80, 6),
        ('Alitas (12 unidades)', 32.00, 50, 6),
        ('Chicharrón de pollo', 22.00, 70, 6),
        ('Nuggets (8 unidades)', 15.00, 60, 6),
        
        # CATEGORÍA 7: Postres
        ('Pie de manzana', 8.00, 50, 7),
        ('Helado (1 bola)', 5.00, 100, 7),
        ('Suspiro limeño', 7.00, 40, 7),
        ('Mazamorra morada', 6.00, 40, 7)
    ]

    # Insertar todos los artículos
    conn.executemany("INSERT INTO articulos (nombre, precio, stock, categoria_id) VALUES (?, ?, ?, ?)", articulos_data)

    conn.commit()
    conn.close()

# Inicializar la base de datos al inicio
setup_database()

# --------------------------------------------------------------------------------
# RUTA DE ESTADÍSTICAS (NUEVA)
# --------------------------------------------------------------------------------
@app.route('/api/estadisticas', methods=['GET'])
def get_estadisticas():
    """Calcula y devuelve las estadísticas clave del negocio."""
    conn = get_db_connection()
    try:
        # --- 1. Ventas por Período (Diarias, Semanales, Mensuales) ---
        
        # Obtener ventas totales por fecha (últimos 30 días para un buen gráfico)
        ventas_diarias = conn.execute("""
            SELECT 
                strftime('%Y-%m-%d', fecha) AS dia, 
                SUM(total) AS total_ventas 
            FROM pedidos 
            WHERE fecha >= strftime('%Y-%m-%d', date('now', '-30 day'))
            GROUP BY dia 
            ORDER BY dia;
        """).fetchall()

        # Ventas Totales por Mes (para comparativa)
        ventas_mensuales = conn.execute("""
            SELECT 
                strftime('%Y-%m', fecha) AS mes, 
                SUM(total) AS total_ventas 
            FROM pedidos 
            GROUP BY mes 
            ORDER BY mes DESC 
            LIMIT 12;
        """).fetchall()

        # --- 2. Productos Más/Menos Vendidos (Top 10) ---

        productos_ranking = conn.execute("""
            SELECT 
                pi.nombre AS producto, 
                SUM(pi.cantidad) AS cantidad_vendida,
                SUM(pi.cantidad * pi.precio) AS ingresos_totales
            FROM pedido_items pi
            GROUP BY pi.nombre
            ORDER BY cantidad_vendida DESC;
        """).fetchall()

        top_productos = productos_ranking[:10]
        menos_vendidos = productos_ranking[-10:][::-1] # Últimos 10, ordenados por menos a más

        # --- 3. Ventas por Categoría ---
        
        ventas_por_categoria = conn.execute("""
            SELECT 
                c.nombre AS categoria, 
                SUM(pi.cantidad * pi.precio) AS total_vendido
            FROM pedido_items pi
            JOIN articulos a ON pi.articulo_id = a.id
            JOIN categorias c ON a.categoria_id = c.id
            GROUP BY c.nombre
            ORDER BY total_vendido DESC;
        """).fetchall()

        # --- 4. Comparativa Mes Actual vs Mes Anterior ---
        
        mes_actual = datetime.date.today().strftime('%Y-%m')
        mes_anterior = (datetime.date.today().replace(day=1) - datetime.timedelta(days=1)).strftime('%Y-%m')
        
        ventas_mes_actual_row = conn.execute("""
            SELECT SUM(total) AS total 
            FROM pedidos 
            WHERE strftime('%Y-%m', fecha) = ?;
        """, (mes_actual,)).fetchone()
        
        ventas_mes_anterior_row = conn.execute("""
            SELECT SUM(total) AS total 
            FROM pedidos 
            WHERE strftime('%Y-%m', fecha) = ?;
        """, (mes_anterior,)).fetchone()
        
        ventas_mes_actual = ventas_mes_actual_row['total'] if ventas_mes_actual_row and ventas_mes_actual_row['total'] else 0
        ventas_mes_anterior = ventas_mes_anterior_row['total'] if ventas_mes_anterior_row and ventas_mes_anterior_row['total'] else 0

        # --- Consolidación de Resultados ---

        resultado = {
            "ventasDiarias": [dict(row) for row in ventas_diarias],
            "ventasMensuales": [dict(row) for row in ventas_mensuales],
            "topProductos": [dict(row) for row in top_productos],
            "menosVendidos": [dict(row) for row in menos_vendidos],
            "ventasPorCategoria": [dict(row) for row in ventas_por_categoria],
            "comparativaMes": {
                "mesActual": ventas_mes_actual,
                "mesAnterior": ventas_mes_anterior
            }
        }

        return jsonify({"success": True, "data": resultado})

    except Exception as e:
        print(f"Error en estadísticas: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------------
# CRUD: Proveedores (Mesas)
# --------------------------------------------------------------------------------
@app.route('/api/proveedores', methods=['GET'])
def get_proveedores():
    conn = get_db_connection()
    proveedores = conn.execute('SELECT * FROM proveedores').fetchall()
    conn.close()
    return jsonify([dict(p) for p in proveedores])

@app.route('/api/proveedores', methods=['POST'])
def add_proveedor():
    data = request.get_json()
    nombre = data.get('nombre')
    descripcion = data.get('descripcion', '')

    if not nombre:
        return jsonify({"success": False, "message": "El nombre es obligatorio."}), 400

    conn = get_db_connection()
    try:
        conn.execute('INSERT INTO proveedores (nombre, descripcion) VALUES (?, ?)', (nombre, descripcion))
        conn.commit()
        return jsonify({"success": True, "message": "Mesa agregada correctamente."})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "Ya existe una mesa con ese nombre."}), 400
    finally:
        conn.close()

@app.route('/api/proveedores/<int:id>', methods=['DELETE'])
def delete_proveedor(id):
    conn = get_db_connection()
    try:
        conn.execute('DELETE FROM proveedores WHERE id = ?', (id,))
        conn.commit()
        return jsonify({"success": True, "message": "Mesa eliminada correctamente."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        conn.close()

# --------------------------------------------------------------------------------
# CRUD: Categorías
# --------------------------------------------------------------------------------
@app.route('/api/categorias', methods=['GET'])
def get_categorias():
    conn = get_db_connection()
    categorias = conn.execute('SELECT * FROM categorias').fetchall()
    conn.close()
    return jsonify([dict(c) for c in categorias])

@app.route('/api/categorias', methods=['POST'])
def add_categoria():
    data = request.get_json()
    nombre = data.get('nombre')

    if not nombre:
        return jsonify({"success": False, "message": "El nombre de la categoría es obligatorio."}), 400

    conn = get_db_connection()
    try:
        conn.execute('INSERT INTO categorias (nombre) VALUES (?)', (nombre,))
        conn.commit()
        return jsonify({"success": True, "message": "Categoría agregada correctamente."})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "Ya existe una categoría con ese nombre."}), 400
    finally:
        conn.close()

@app.route('/api/categorias/<int:id>', methods=['DELETE'])
def delete_categoria(id):
    conn = get_db_connection()
    try:
        # Verificar si hay artículos en esta categoría
        articulos_count = conn.execute('SELECT COUNT(*) FROM articulos WHERE categoria_id = ?', (id,)).fetchone()[0]
        if articulos_count > 0:
            return jsonify({"success": False, "message": f"No se puede eliminar la categoría. Aún tiene {articulos_count} artículos asociados."}), 400
        
        conn.execute('DELETE FROM categorias WHERE id = ?', (id,))
        conn.commit()
        return jsonify({"success": True, "message": "Categoría eliminada correctamente."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        conn.close()

# --------------------------------------------------------------------------------
# CRUD: Artículos (Platos/Productos)
# --------------------------------------------------------------------------------
@app.route('/api/articulos', methods=['GET'])
def get_articulos():
    categoria_id = request.args.get('categoria_id')
    conn = get_db_connection()
    
    query = 'SELECT a.*, c.nombre AS categoria_nombre FROM articulos a JOIN categorias c ON a.categoria_id = c.id'
    params = []

    if categoria_id:
        query += ' WHERE a.categoria_id = ?'
        params.append(categoria_id)

    articulos = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(a) for a in articulos])

@app.route('/api/articulos', methods=['POST'])
def add_articulo():
    data = request.get_json()
    nombre = data.get('nombre')
    precio = data.get('precio')
    stock = data.get('stock')
    categoria_id = data.get('categoria_id')

    if not all([nombre, precio is not None, stock is not None, categoria_id is not None]):
        return jsonify({"success": False, "message": "Faltan datos obligatorios."}), 400

    conn = get_db_connection()
    try:
        conn.execute('INSERT INTO articulos (nombre, precio, stock, categoria_id) VALUES (?, ?, ?, ?)', 
                     (nombre, precio, stock, categoria_id))
        conn.commit()
        return jsonify({"success": True, "message": "Artículo agregado correctamente."})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "Ya existe un artículo con ese nombre."}), 400
    finally:
        conn.close()

@app.route('/api/articulos/<int:id>', methods=['PUT'])
def update_articulo(id):
    data = request.get_json()
    nombre = data.get('nombre')
    precio = data.get('precio')
    stock = data.get('stock')
    categoria_id = data.get('categoria_id')

    if not all([nombre, precio is not None, stock is not None, categoria_id is not None]):
        return jsonify({"success": False, "message": "Faltan datos obligatorios para la actualización."}), 400

    conn = get_db_connection()
    try:
        # Nota: El objeto conn.execute() devuelve un cursor, por eso rowcount está disponible aquí.
        cursor = conn.execute('UPDATE articulos SET nombre = ?, precio = ?, stock = ?, categoria_id = ? WHERE id = ?', 
                     (nombre, precio, stock, categoria_id, id))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"success": False, "message": "Artículo no encontrado."}), 404
        return jsonify({"success": True, "message": "Artículo actualizado correctamente."})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "Ya existe otro artículo con ese nombre."}), 400
    finally:
        conn.close()

@app.route('/api/articulos/<int:id>', methods=['DELETE'])
def delete_articulo(id):
    conn = get_db_connection()
    try:
        # Nota: El objeto conn.execute() devuelve un cursor.
        cursor = conn.execute('DELETE FROM articulos WHERE id = ?', (id,))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"success": False, "message": "Artículo no encontrado."}), 404
        return jsonify({"success": True, "message": "Artículo eliminado correctamente."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        conn.close()

# --------------------------------------------------------------------------------
# CRUD: Pedidos
# --------------------------------------------------------------------------------
@app.route('/api/pedidos', methods=['POST'])
def add_pedido():
    data = request.get_json()
    mesa_id = data.get('mesa_id')
    items = data.get('items')
    total = data.get('total')
    pedido_id = data.get('pedido_id', None) # Para edición

    if not all([mesa_id, items, total is not None]):
        return jsonify({"success": False, "message": "Faltan datos obligatorios para el pedido."}), 400

    conn = get_db_connection()
    try:
        if pedido_id:
            # 1. Eliminar ítems anteriores si es una edición
            conn.execute('DELETE FROM pedido_items WHERE id_pedido = ?', (pedido_id,))
            
            # 2. Actualizar el pedido
            conn.execute('UPDATE pedidos SET proveedor_id = ?, total = ?, fecha = ? WHERE id = ?',
                         (mesa_id, total, datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'), pedido_id))
            
            message = "Pedido actualizado correctamente."
        else:
            # 1. Crear nuevo pedido
            cursor = conn.execute('INSERT INTO pedidos (fecha, proveedor_id, total) VALUES (?, ?, ?)',
                                (datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'), mesa_id, total))
            pedido_id = cursor.lastrowid
            message = "Pedido guardado correctamente."

        # 2. Insertar ítems del pedido
        for item in items:
            conn.execute('INSERT INTO pedido_items (id_pedido, articulo_id, nombre, cantidad, precio) VALUES (?, ?, ?, ?, ?)',
                         (pedido_id, item.get('id'), item.get('nombre'), item.get('cantidad'), item.get('precio')))

        conn.commit()
        return jsonify({"success": True, "message": message, "pedido_id": pedido_id})
    except Exception as e:
        conn.rollback()
        print(f"Error al guardar/actualizar pedido: {e}")
        return jsonify({"success": False, "message": "Error interno del servidor al procesar el pedido."}), 500
    finally:
        conn.close()

@app.route('/api/pedidos', methods=['GET'])
def get_pedidos():
    conn = get_db_connection()
    pedidos = conn.execute("""
        SELECT 
            p.id, 
            p.fecha, 
            pr.nombre AS mesa_nombre, 
            p.total, 
            p.estado
        FROM pedidos p
        JOIN proveedores pr ON p.proveedor_id = pr.id
        ORDER BY p.fecha DESC
    """).fetchall()
    conn.close()
    return jsonify([dict(p) for p in pedidos])

@app.route('/api/pedidos/<int:id>', methods=['GET'])
def get_pedido_details(id):
    conn = get_db_connection()
    try:
        pedido = conn.execute('SELECT * FROM pedidos WHERE id = ?', (id,)).fetchone()
        items = conn.execute('SELECT * FROM pedido_items WHERE id_pedido = ?', (id,)).fetchall()
        mesa = conn.execute('SELECT nombre FROM proveedores WHERE id = ?', (pedido['proveedor_id'],)).fetchone()
        
        if not pedido:
            return jsonify({"success": False, "message": "Pedido no encontrado."}), 404

        return jsonify({
            "success": True,
            "pedido": {
                **dict(pedido),
                "mesa_nombre": mesa['nombre'] if mesa else 'Desconocida',
                "items": [dict(i) for i in items]
            }
        })
    finally:
        conn.close()


@app.route('/api/pedidos/<int:id>', methods=['DELETE'])
def delete_pedido(id):
    conn = get_db_connection()
    try:
        # 1. Eliminar los items del pedido
        conn.execute('DELETE FROM pedido_items WHERE id_pedido = ?', (id,))
        
        # 2. Eliminar el pedido y capturar el cursor para obtener rowcount (CORRECCIÓN)
        cursor = conn.execute('DELETE FROM pedidos WHERE id = ?', (id,))
        
        conn.commit()
        
        # 3. Comprobar el rowcount del cursor (CORRECCIÓN APLICADA AQUÍ)
        if cursor.rowcount == 0:
            return jsonify({"success": False, "message": "Pedido no encontrado."}), 404
            
        return jsonify({"success": True, "message": "Pedido eliminado correctamente."})
    except Exception as e:
        conn.rollback() 
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        conn.close()

# --------------------------------------------------------------------------------
# RUTA DE EXPORTACIÓN CSV
# --------------------------------------------------------------------------------
@app.route('/api/exportar/pedidos', methods=['GET'])
def export_pedidos_csv():
    conn = get_db_connection()
    
    # Parámetros opcionales para filtrar
    fecha_inicio = request.args.get('fecha_inicio')
    fecha_fin = request.args.get('fecha_fin')
    mesa_id = request.args.get('mesa_id')

    params = []
    where_sql = "1=1" 

    if fecha_inicio:
        where_sql += " AND date(p.fecha) >= ?"
        params.append(fecha_inicio)

    if fecha_fin:
        where_sql += " AND date(p.fecha) <= ?"
        params.append(fecha_fin)
    
    if mesa_id:
        where_sql += " AND p.proveedor_id = ?"
        params.append(mesa_id)
    
    query = f"""
        SELECT 
            p.id AS ID_Pedido, 
            p.fecha AS Fecha, 
            pr.nombre AS Mesa_Asignada,
            pi.nombre AS Plato_Producto, 
            pi.cantidad AS Cantidad,
            pi.precio AS Precio_Unitario,
            (pi.cantidad * pi.precio) AS Subtotal_Item,
            p.total AS Total_Pedido,
            p.estado AS Estado
        FROM pedidos p
        JOIN proveedores pr ON p.proveedor_id = pr.id
        JOIN pedido_items pi ON p.id = pi.id_pedido
        WHERE {where_sql}
        ORDER BY p.fecha DESC, p.id
    """
    data = conn.execute(query, params).fetchall()
    conn.close()

    if not data:
        return jsonify({"success": False, "message": "No hay datos para exportar con los filtros seleccionados."}), 404

    si = StringIO()
    cw = csv.writer(si)

    headers = data[0].keys()
    cw.writerow(headers)

    for row in data:
        cw.writerow(list(row))

    output = si.getvalue()
    
    response = Response(output, mimetype='text/csv')
    response.headers["Content-Disposition"] = "attachment; filename=reporte_pedidos.csv"
    return response


if __name__ == '__main__':
    app.run(debug=True)