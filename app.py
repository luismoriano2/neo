import sqlite3
from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS
import json
import datetime
import csv
from io import StringIO
import os  # IMPORTANTE: Necesario para Render

# CONFIGURACIÓN DE FLASK
# static_folder='.' indica que busque el index.html en la carpeta principal
app = Flask(__name__, static_folder='.', static_url_path='/')
# Habilita CORS para todas las rutas /api/*
CORS(app, resources={r"/api/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE"]}}) 

# CONFIGURACIÓN DE FLASK ---DATABASE = 'inventario.db'
basedir = os.path.abspath(os.path.dirname(__file__))
DATABASE = os.path.join(basedir, 'inventario.db')
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
    """Establece una conexión a la base de datos."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def setup_database():
    """Inicializa la base de datos creando tablas si no existen."""
    conn = get_db_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE
        );
    """)

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

    conn.execute("""
        CREATE TABLE IF NOT EXISTS proveedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            descripcion TEXT
        );
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT NOT NULL,
            proveedor_id INTEGER,
            total REAL NOT NULL,
            estado TEXT NOT NULL DEFAULT 'PENDIENTE',
            FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
        );
    """)

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
    
    # Poblamiento inicial si está vacía
    if not conn.execute("SELECT 1 FROM categorias").fetchone():
        categorias_data = [
            (1, 'Pollos 🍗'), (2, 'Combos Personales 🍽️'), (3, 'Guarniciones 🍟'),
            (4, 'Bebidas 🥤'), (5, 'Salsas y Extras 🌶️'), (6, 'Extras de Pollo 🍖'), (7, 'Postres 🍰')
        ]
        for id, nombre in categorias_data:
            conn.execute("INSERT OR REPLACE INTO categorias (id, nombre) VALUES (?, ?)", (id, nombre))

    if not conn.execute("SELECT 1 FROM proveedores").fetchone():
        conn.execute("INSERT INTO proveedores (nombre) VALUES ('Mesa 1'), ('Mesa 2'), ('Mesa 3'), ('Mesa Delivery')")

    conn.commit()
    conn.close()

# Inicializar la base de datos
setup_database()

# --------------------------------------------------------------------------------
# APIS (MANTENIENDO TU LÓGICA)
# --------------------------------------------------------------------------------

@app.route('/api/estadisticas', methods=['GET'])
def get_estadisticas():
    conn = get_db_connection()
    try:
        ventas_diarias = conn.execute("SELECT strftime('%Y-%m-%d', fecha) AS dia, SUM(total) AS total_ventas FROM pedidos WHERE fecha >= strftime('%Y-%m-%d', date('now', '-30 day')) GROUP BY dia ORDER BY dia;").fetchall()
        ventas_mensuales = conn.execute("SELECT strftime('%Y-%m', fecha) AS mes, SUM(total) AS total_ventas FROM pedidos GROUP BY mes ORDER BY mes DESC LIMIT 12;").fetchall()
        productos_ranking = conn.execute("SELECT pi.nombre AS producto, SUM(pi.cantidad) AS cantidad_vendida, SUM(pi.cantidad * pi.precio) AS ingresos_totales FROM pedido_items pi GROUP BY pi.nombre ORDER BY cantidad_vendida DESC;").fetchall()
        
        ventas_por_categoria = conn.execute("""
            SELECT c.nombre AS categoria, SUM(pi.cantidad * pi.precio) AS total_vendido
            FROM pedido_items pi
            JOIN articulos a ON pi.articulo_id = a.id
            JOIN categorias c ON a.categoria_id = c.id
            GROUP BY c.nombre ORDER BY total_vendido DESC;
        """).fetchall()

        resultado = {
            "ventasDiarias": [dict(row) for row in ventas_diarias],
            "ventasMensuales": [dict(row) for row in ventas_mensuales],
            "topProductos": [dict(row) for row in productos_ranking[:10]],
            "ventasPorCategoria": [dict(row) for row in ventas_por_categoria]
        }
        return jsonify({"success": True, "data": resultado})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/proveedores', methods=['GET', 'POST'])
def manejar_proveedores():
    conn = get_db_connection()
    if request.method == 'GET':
        proveedores = conn.execute('SELECT * FROM proveedores').fetchall()
        conn.close()
        return jsonify([dict(p) for p in proveedores])
    else:
        data = request.get_json()
        try:
            conn.execute('INSERT INTO proveedores (nombre, descripcion) VALUES (?, ?)', (data['nombre'], data.get('descripcion', '')))
            conn.commit()
            return jsonify({"success": True})
        except:
            return jsonify({"success": False}), 400
        finally:
            conn.close()

@app.route('/api/categorias', methods=['GET', 'POST'])
def manejar_categorias():
    conn = get_db_connection()
    if request.method == 'GET':
        categorias = conn.execute('SELECT * FROM categorias').fetchall()
        conn.close()
        return jsonify([dict(c) for c in categorias])
    else:
        data = request.get_json()
        conn.execute('INSERT INTO categorias (nombre) VALUES (?)', (data['nombre'],))
        conn.commit()
        conn.close()
        return jsonify({"success": True})

@app.route('/api/articulos', methods=['GET', 'POST'])
def manejar_articulos():
    conn = get_db_connection()
    if request.method == 'GET':
        cat_id = request.args.get('categoria_id')
        query = 'SELECT a.*, c.nombre AS categoria_nombre FROM articulos a JOIN categorias c ON a.categoria_id = c.id'
        articulos = conn.execute(query + ' WHERE a.categoria_id = ?' if cat_id else query, [cat_id] if cat_id else []).fetchall()
        conn.close()
        return jsonify([dict(a) for a in articulos])
    else:
        data = request.get_json()
        conn.execute('INSERT INTO articulos (nombre, precio, stock, categoria_id) VALUES (?, ?, ?, ?)', (data['nombre'], data['precio'], data['stock'], data['categoria_id']))
        conn.commit()
        conn.close()
        return jsonify({"success": True})

@app.route('/api/pedidos', methods=['GET', 'POST'])
def manejar_pedidos():
    conn = get_db_connection()
    if request.method == 'POST':
        data = request.get_json()
        cursor = conn.execute('INSERT INTO pedidos (fecha, proveedor_id, total) VALUES (?, ?, ?)',
                            (datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'), data['mesa_id'], data['total']))
        p_id = cursor.lastrowid
        for item in data['items']:
            conn.execute('INSERT INTO pedido_items (id_pedido, articulo_id, nombre, cantidad, precio) VALUES (?, ?, ?, ?, ?)',
                         (p_id, item.get('id'), item.get('nombre'), item.get('cantidad'), item.get('precio')))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "pedido_id": p_id})
    else:
        pedidos = conn.execute("SELECT p.*, pr.nombre AS mesa_nombre FROM pedidos p JOIN proveedores pr ON p.proveedor_id = pr.id ORDER BY p.fecha DESC").fetchall()
        conn.close()
        return jsonify([dict(p) for p in pedidos])

@app.route('/api/pedidos/<int:id>', methods=['DELETE'])
def eliminar_pedido(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM pedido_items WHERE id_pedido = ?', (id,))
    conn.execute('DELETE FROM pedidos WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route('/api/exportar/pedidos')
def exportar_csv():
    conn = get_db_connection()
    query = """SELECT p.id, p.fecha, pr.nombre, pi.nombre, pi.cantidad, pi.precio, (pi.cantidad * pi.precio), p.total 
               FROM pedidos p JOIN proveedores pr ON p.proveedor_id = pr.id JOIN pedido_items pi ON p.id = pi.id_pedido"""
    data = conn.execute(query).fetchall()
    conn.close()
    si = StringIO()
    cw = csv.writer(si)
    cw.writerow(['ID', 'Fecha', 'Mesa', 'Producto', 'Cant', 'Precio', 'Subtotal', 'Total'])
    for row in data: cw.writerow(list(row))
    return Response(si.getvalue(), mimetype='text/csv', headers={"Content-Disposition": "attachment; filename=reporte.csv"})

# --------------------------------------------------------------------------------
# INICIO DE LA APLICACIÓN (CORREGIDO PARA RENDER)
# --------------------------------------------------------------------------------
if __name__ == '__main__':
    # Render usa la variable de entorno PORT, si no existe usa el 5000 (local)
    port = int(os.environ.get('PORT', 5000))
    # host='0.0.0.0' es obligatorio para que el servidor sea accesible externamente
    app.run(host='0.0.0.0', port=port)@app.route('/api/articulos/<int:id>', methods=['PUT'])
def actualizar_articulo(id):
    conn = get_db_connection()
    data = request.get_json()
    try:
        conn.execute('UPDATE articulos SET nombre = ?, precio = ?, stock = ?, categoria_id = ? WHERE id = ?',
                     (data['nombre'], data['precio'], data['stock'], data['categoria_id'], id))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/articulos/<int:id>', methods=['DELETE'])
def eliminar_articulo(id):
    conn = get_db_connection()
    try:
        conn.execute('DELETE FROM articulos WHERE id = ?', (id,))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        conn.close()
