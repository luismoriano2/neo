import sqlite3
from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS
import json
import datetime
import csv
from io import StringIO
import os

# --- CONFIGURACIÓN DE FLASK PARA RENDER ---
# static_url_path='' evita que Flask bloquee las rutas /api
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*"}}) 

# --- RUTA ABSOLUTA DE BASE DE DATOS ---
basedir = os.path.abspath(os.path.dirname(__file__))
DATABASE = os.path.join(basedir, 'inventario.db')

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def setup_database():
    conn = get_db_connection()
    # Creación de tablas
    conn.execute("CREATE TABLE IF NOT EXISTS categorias (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE);")
    conn.execute("CREATE TABLE IF NOT EXISTS articulos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE, precio REAL NOT NULL, stock INTEGER NOT NULL DEFAULT 0, categoria_id INTEGER, FOREIGN KEY (categoria_id) REFERENCES categorias(id));")
    conn.execute("CREATE TABLE IF NOT EXISTS proveedores (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE, descripcion TEXT);")
    conn.execute("CREATE TABLE IF NOT EXISTS pedidos (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL, proveedor_id INTEGER, total REAL NOT NULL, estado TEXT NOT NULL DEFAULT 'PENDIENTE', FOREIGN KEY (proveedor_id) REFERENCES proveedores(id));")
    conn.execute("CREATE TABLE IF NOT EXISTS pedido_items (id INTEGER PRIMARY KEY AUTOINCREMENT, id_pedido INTEGER NOT NULL, articulo_id INTEGER, nombre TEXT NOT NULL, cantidad INTEGER NOT NULL, precio REAL NOT NULL, FOREIGN KEY (id_pedido) REFERENCES pedidos(id), FOREIGN KEY (articulo_id) REFERENCES articulos(id));")
    
    # Datos iniciales
    if not conn.execute("SELECT 1 FROM categorias").fetchone():
        categorias = [(1, 'Pollos 🍗'), (2, 'Combos 🍽️'), (3, 'Guarniciones 🍟'), (4, 'Bebidas 🥤')]
        for id, nom in categorias:
            conn.execute("INSERT OR REPLACE INTO categorias (id, nombre) VALUES (?, ?)", (id, nom))

    if not conn.execute("SELECT 1 FROM proveedores").fetchone():
        for m in ['Mesa 1', 'Mesa 2', 'Mesa 3', 'Delivery']:
            conn.execute("INSERT INTO proveedores (nombre) VALUES (?)", (m,))
    conn.commit()
    conn.close()

setup_database()

# --- RUTAS DE LA API ---

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/proveedores', methods=['GET'])
def get_proveedores():
    conn = get_db_connection()
    items = conn.execute('SELECT * FROM proveedores').fetchall()
    conn.close()
    return jsonify([dict(i) for i in items])

@app.route('/api/categorias', methods=['GET'])
def get_categorias():
    conn = get_db_connection()
    items = conn.execute('SELECT * FROM categorias').fetchall()
    conn.close()
    return jsonify([dict(i) for i in items])

@app.route('/api/articulos', methods=['GET'])
def get_articulos():
    conn = get_db_connection()
    items = conn.execute('SELECT a.*, c.nombre AS categoria_nombre FROM articulos a JOIN categorias c ON a.categoria_id = c.id').fetchall()
    conn.close()
    return jsonify([dict(i) for i in items])

@app.route('/api/pedidos', methods=['GET', 'POST'])
def manejar_pedidos():
    conn = get_db_connection()
    if request.method == 'POST':
        data = request.get_json()
        cursor = conn.execute('INSERT INTO pedidos (fecha, proveedor_id, total) VALUES (?, ?, ?)',
                            (datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'), data['mesa_id'], data['total']))
        p_id = cursor.lastrowid
        for i in data['items']:
            conn.execute('INSERT INTO pedido_items (id_pedido, articulo_id, nombre, cantidad, precio) VALUES (?, ?, ?, ?, ?)',
                         (p_id, i.get('id'), i.get('nombre'), i.get('cantidad'), i.get('precio')))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)