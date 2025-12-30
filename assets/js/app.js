document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURACIÓN DE URL ---
    // Esto permite que funcione tanto en tu PC como en Render automáticamente
   // En app.js cambia la constante a:
    const PYTHON_SERVER_URL = window.location.origin + '/api/'; // SIN barra al final
    
    // Variables de estado
    let itemsCarrito = []; 
    let articulosDisponibles = []; 
    let mesaSeleccionadaId = null;

    // --- 1. CARGA DE DATOS (MESAS, CATEGORÍAS, ARTÍCULOS) ---

    async function cargarDatosIniciales() {
        await cargarMesas();
        await cargarCategorias();
        await cargarArticulos(); // Carga todos al inicio
        await cargarHistorial();
        if(typeof cargarEstadisticas === 'function') cargarEstadisticas();
    }

    async function cargarMesas() {
        try {
            const res = await fetch(`${PYTHON_SERVER_URL}proveedores`);
            const mesas = await res.json();
            const contenedor = document.getElementById('lista-mesas-botones');
            const selectFiltro = document.getElementById('filtroMesa');

            const html = mesas.map(m => `
                <button type="button" class="list-group-item list-group-item-action btn-mesa" id="btn-mesa-${m.id}" onclick="seleccionarMesa(${m.id}, '${m.nombre}')">
                    <i class="fas fa-utensils"></i> ${m.nombre}
                </button>
            `).join('');
            
            contenedor.innerHTML = html;
            if(selectFiltro) {
                selectFiltro.innerHTML = '<option value="">Todas las Mesas</option>' + 
                mesas.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
            }
        } catch (e) { console.error("Error mesas:", e); }
    }

    async function cargarCategorias() {
        try {
            const res = await fetch(`${PYTHON_SERVER_URL}categorias`);
            const cats = await res.json();
            const contenedor = document.getElementById('lista-categorias-botones');
            const selectArticulo = document.getElementById('articuloCategoria');

            contenedor.innerHTML = `<button class="btn btn-outline-danger active" onclick="filtrarPorCategoria(null)">Todos</button>` + 
                cats.map(c => `<button class="btn btn-outline-danger" onclick="filtrarPorCategoria(${c.id})">${c.nombre}</button>`).join('');
            
            if(selectArticulo) {
                selectArticulo.innerHTML = cats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
            }
        } catch (e) { console.error("Error categorías:", e); }
    }

    window.cargarArticulos = async () => {
        try {
            const res = await fetch(`${PYTHON_SERVER_URL}articulos`);
            articulosDisponibles = await res.json();
            renderizarArticulos(articulosDisponibles);
            renderizarInventario();
        } catch (e) { console.error("Error artículos:", e); }
    };

    window.filtrarPorCategoria = (catId) => {
        const filtrados = catId ? articulosDisponibles.filter(a => a.categoria_id === catId) : articulosDisponibles;
        renderizarArticulos(filtrados);
    };

    function renderizarArticulos(lista) {
        const contenedor = document.getElementById('lista-articulos');
        contenedor.innerHTML = lista.map(art => `
            <div class="col-md-4 mb-3">
                <div class="card h-100 shadow-sm item-articulo" onclick="agregarAlCarrito(${art.id})" style="cursor:pointer">
                    <div class="card-body text-center p-2">
                        <h6 class="card-title mb-1">${art.nombre}</h6>
                        <p class="card-text text-danger font-weight-bold">S/ ${art.precio.toFixed(2)}</p>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // --- 2. LÓGICA DEL CARRITO ---

    window.seleccionarMesa = (id, nombre) => {
        mesaSeleccionadaId = id;
        document.getElementById('mesa-seleccionada-nombre').innerText = nombre;
        document.querySelectorAll('.btn-mesa').forEach(b => b.classList.remove('active', 'bg-danger', 'text-white'));
        document.getElementById(`btn-mesa-${id}`).classList.add('active', 'bg-danger', 'text-white');
        validarBotonGuardar();
    };

    window.agregarAlCarrito = (id) => {
        const art = articulosDisponibles.find(a => a.id === id);
        const existe = itemsCarrito.find(i => i.id === id);
        if(existe) { existe.cantidad++; } 
        else { itemsCarrito.push({...art, cantidad: 1}); }
        actualizarCarritoUI();
    };

    window.cambiarCantidad = (index, delta) => {
        itemsCarrito[index].cantidad += delta;
        if(itemsCarrito[index].cantidad <= 0) itemsCarrito.splice(index, 1);
        actualizarCarritoUI();
    };

    function actualizarCarritoUI() {
        const contenedor = document.getElementById('items-del-pedido');
        const vacioText = document.getElementById('texto-carrito-vacio');
        
        if(itemsCarrito.length === 0) {
            contenedor.innerHTML = '<p class="text-muted text-center" id="texto-carrito-vacio">El carrito está vacío.</p>';
        } else {
            contenedor.innerHTML = itemsCarrito.map((item, i) => `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom bg-white rounded">
                    <div style="flex:1">
                        <div class="font-weight-bold small">${item.nombre}</div>
                        <div class="text-danger small">S/ ${(item.precio * item.cantidad).toFixed(2)}</div>
                    </div>
                    <div class="d-flex align-items-center">
                        <button class="btn btn-sm btn-outline-secondary px-2" onclick="cambiarCantidad(${i}, -1)">-</button>
                        <span class="mx-2 font-weight-bold">${item.cantidad}</span>
                        <button class="btn btn-sm btn-outline-secondary px-2" onclick="cambiarCantidad(${i}, 1)">+</button>
                    </div>
                </div>
            `).join('');
        }

        const total = itemsCarrito.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);
        document.getElementById('total-acumulado').innerText = `S/ ${total.toFixed(2)}`;
        document.getElementById('contador-items').innerText = itemsCarrito.length;
        validarBotonGuardar();
    }

    function validarBotonGuardar() {
        const btn = document.getElementById('btnGuardarPedido');
        btn.disabled = !(mesaSeleccionadaId && itemsCarrito.length > 0);
    }

    // --- 3. GUARDAR Y ELIMINAR PEDIDOS ---

    document.getElementById('btnGuardarPedido').addEventListener('click', async () => {
        const pedido = {
            mesa_id: mesaSeleccionadaId,
            items: itemsCarrito,
            total: itemsCarrito.reduce((acc, i) => acc + (i.precio * i.cantidad), 0)
        };

        try {
            const res = await fetch(`${PYTHON_SERVER_URL}pedidos`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(pedido)
            });
            if(res.ok) {
                alert("✅ Pedido guardado!");
                itemsCarrito = [];
                mesaSeleccionadaId = null;
                document.getElementById('mesa-seleccionada-nombre').innerText = "--";
                actualizarCarritoUI();
                cargarHistorial();
            }
        } catch (e) { alert("Error al guardar"); }
    });

    async function cargarHistorial() {
        try {
            const res = await fetch(`${PYTHON_SERVER_URL}/pedidos`);
            const pedidos = await res.json();
            const tabla = document.getElementById('lista-pedidos-historial');
            tabla.innerHTML = pedidos.map(p => `
                <tr>
                    <td>${p.id}</td>
                    <td>${p.fecha}</td>
                    <td>${p.mesa_nombre}</td>
                    <td>S/ ${p.total.toFixed(2)}</td>
                    <td><span class="badge badge-success">${p.estado}</span></td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="eliminarPedido(${p.id})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (e) { console.error(e); }
    }

    window.eliminarPedido = async (id) => {
        if(!confirm("¿Seguro de eliminar este pedido?")) return;
        await fetch(`${PYTHON_SERVER_URL}pedidos/${id}`, { method: 'DELETE' });
        cargarHistorial();
    };

    // --- 4. INVENTARIO (PARA TU PESTAÑA DE INVENTARIO) ---
    function renderizarInventario() {
        const tabla = document.getElementById('lista-articulos-inventario');
        if(!tabla) return;
        tabla.innerHTML = articulosDisponibles.map(a => `
            <tr>
                <td>${a.id}</td>
                <td>${a.nombre}</td>
                <td>S/ ${a.precio.toFixed(2)}</td>
                <td>${a.stock}</td>
                <td>${a.categoria_nombre || 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="alert('Función de edición en desarrollo')"><i class="fas fa-edit"></i></button>
                </td>
            </tr>
        `).join('');
    }

    // --- INICIO ---
    cargarDatosIniciales();
});