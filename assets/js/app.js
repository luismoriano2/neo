// ------------------------------------------------------------------
// assets/js/app.js (CÓDIGO COMPLETO Y CORREGIDO)
// ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {

    // --- Variables de Configuración y Elementos DOM ---
    //const PYTHON_SERVER_URL = 'http://127.0.0.1:5000/api/'; 
    const PYTHON_SERVER_URL = window.location.origin + '/api/';
    // Datos de la aplicación
    let itemsCarrito = []; 
    let articulosDisponibles = []; 
    let proveedoresDisponibles = []; 
    let categoriasDisponibles = []; 
    let categoriaSeleccionadaId = 1; // ID inicial para la primera carga de productos

    // Elementos de Pedido
    const totalAcumuladoElement = document.getElementById('total-acumulado');
    const itemsDelPedidoElement = document.getElementById('items-del-pedido');
    const contadorItemsElement = document.getElementById('contador-items');
    const listaHistorial = document.getElementById('lista-pedidos-historial');
    const btnGuardarPedido = document.getElementById('btnGuardarPedido');
    const pedidoIdEditando = document.getElementById('pedidoIdEditando'); 
    
    // ZONA DE CAMBIO: Variables para la nueva interfaz de botones
    const listaMesasBotones = document.getElementById('lista-mesas-botones'); // Nuevo contenedor de botones
    let mesaSeleccionadaId = null; // Variable para almacenar la ID de la mesa seleccionada
    // FIN ZONA DE CAMBIO

    const listaArticulosDiv = document.getElementById('lista-articulos');
    const listaCategoriasBotones = document.getElementById('lista-categorias-botones');
    const mesaSeleccionadaNombre = document.getElementById('mesa-seleccionada-nombre');
    const textoCarritoVacio = document.getElementById('texto-carrito-vacio');
    
    // Elementos de Inventario
    const listaArticulosInventario = document.getElementById('lista-articulos-inventario');
    const articuloCategoriaSelect = document.getElementById('articuloCategoria');
    const articuloIdInput = document.getElementById('articuloId');
    const formArticulo = document.getElementById('formArticulo');
    const btnCancelarEdicionArticulo = document.getElementById('btnCancelarEdicionArticulo');
    
    // Elementos de Tablas Base
    const listaProveedores = document.getElementById('lista-proveedores');
    const formProveedor = document.getElementById('formProveedor');
    const listaCategoriasInventario = document.getElementById('lista-categorias-inventario');
    const formCategoria = document.getElementById('formCategoria');

    // Elementos de Reportes
    const filtroMesaSelect = document.getElementById('filtroMesa');
    const btnFiltrarHistorial = document.getElementById('btnFiltrarHistorial');
    const btnExportarCSV = document.getElementById('btnExportarCSV');

    // --- UTILIDADES ---

    // Función para dar formato de moneda
    const formatter = new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN'
    });

    // Función genérica para manejar peticiones fetch
    async function apiFetch(url, method = 'GET', data = null) {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(PYTHON_SERVER_URL + url, options);
            
            // Si la respuesta es 204 No Content (como en algunos DELETE), devolver éxito sin JSON
            if (response.status === 204) {
                return { success: true, message: "Operación exitosa." };
            }

            const result = await response.json();
            
            if (!response.ok) {
                // Lanzar un error con el mensaje de la API si la respuesta no es OK
                throw new Error(result.message || `Error en la petición: ${response.statusText}`);
            }
            // Devolver el resultado. Para rutas GET que retornan arrays, 'result' será el array.
            return result; 
        } catch (error) {
            console.error(`Error en la llamada a la API (${url}):`, error);
            alert(`Error: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    // --- LÓGICA DE PEDIDOS ---

    function seleccionarMesa(id, nombre) {
        mesaSeleccionadaId = id;
        mesaSeleccionadaNombre.textContent = nombre;
        btnGuardarPedido.disabled = itemsCarrito.length === 0;
        // Opcional: Deseleccionar todos y seleccionar solo el actual
        document.querySelectorAll('#lista-mesas-botones .btn').forEach(btn => {
            btn.classList.remove('btn-danger', 'active');
            btn.classList.add('btn-secondary');
        });
        const botonSeleccionado = document.querySelector(`#lista-mesas-botones button[data-id="${id}"]`);
        if (botonSeleccionado) {
            botonSeleccionado.classList.remove('btn-secondary');
            botonSeleccionado.classList.add('btn-danger', 'active');
        }
    }

    function renderizarMesas() {
        listaMesasBotones.innerHTML = '';
        proveedoresDisponibles.forEach(mesa => {
            const button = document.createElement('button');
            button.className = `btn btn-block mb-2 btn-secondary`;
            button.textContent = mesa.nombre;
            button.setAttribute('data-id', mesa.id);
            button.onclick = () => seleccionarMesa(mesa.id, mesa.nombre);
            listaMesasBotones.appendChild(button);
        });

        // Inicializar la primera mesa como seleccionada si existe
        if (proveedoresDisponibles.length > 0 && !mesaSeleccionadaId) {
            seleccionarMesa(proveedoresDisponibles[0].id, proveedoresDisponibles[0].nombre);
        }
    }

    function renderizarCategorias() {
        listaCategoriasBotones.innerHTML = '';
        categoriasDisponibles.forEach(cat => {
            const button = document.createElement('button');
            button.className = `btn btn-sm ${cat.id == categoriaSeleccionadaId ? 'btn-danger' : 'btn-outline-danger'}`;
            button.textContent = cat.nombre;
            button.onclick = () => {
                categoriaSeleccionadaId = cat.id;
                renderizarCategorias(); // Volver a renderizar para actualizar el estado activo
                cargarArticulos();
            };
            listaCategoriasBotones.appendChild(button);
        });
    }

    function renderizarArticulos() {
        listaArticulosDiv.innerHTML = '';
        const articulosFiltrados = articulosDisponibles.filter(a => a.categoria_id == categoriaSeleccionadaId);

        if (articulosFiltrados.length === 0) {
            listaArticulosDiv.innerHTML = '<div class="col-12"><p class="text-center text-muted">No hay artículos en esta categoría.</p></div>';
            return;
        }

        articulosFiltrados.forEach(articulo => {
            const card = document.createElement('div');
            card.className = 'col-sm-6 col-md-4 col-lg-3 mb-3';
            card.innerHTML = `
                <div class="card p-2 h-100 shadow-sm clickable-card" onclick="agregarAlCarrito(${articulo.id}, '${articulo.nombre.replace(/'/g, "\\'")}', ${articulo.precio}, ${articulo.stock})">
                    <h6 class="font-weight-bold text-dark">${articulo.nombre}</h6>
                    <p class="mb-0 text-success">S/ ${articulo.precio.toFixed(2)}</p>
                    <small class="text-muted">Stock: ${articulo.stock}</small>
                </div>
            `;
            listaArticulosDiv.appendChild(card);
        });
    }

    function agregarAlCarrito(id, nombre, precio, stock) {
        if (stock <= 0) {
            alert('¡Producto agotado!');
            return;
        }

        const itemExistente = itemsCarrito.find(item => item.id === id);

        if (itemExistente) {
            // Verifica que la nueva cantidad no exceda el stock
            if (itemExistente.cantidad < stock) {
                itemExistente.cantidad++;
            } else {
                alert(`Solo quedan ${stock} unidades de ${nombre}.`);
            }
        } else {
            // Añadir el nuevo ítem
            itemsCarrito.push({ id, nombre, precio, cantidad: 1, stock });
        }

        renderizarCarrito();
    }

    function cambiarCantidad(id, delta) {
        const item = itemsCarrito.find(item => item.id === id);
        if (item) {
            const nuevaCantidad = item.cantidad + delta;
            if (nuevaCantidad > 0) {
                if (nuevaCantidad <= item.stock) {
                    item.cantidad = nuevaCantidad;
                } else {
                    alert(`Solo quedan ${item.stock} unidades de ${item.nombre}.`);
                }
            } else {
                // Eliminar si la cantidad llega a 0
                eliminarArticulo(id);
                return;
            }
        }
        renderizarCarrito();
    }

    function eliminarArticulo(id) {
        itemsCarrito = itemsCarrito.filter(item => item.id !== id);
        renderizarCarrito();
    }

    function renderizarCarrito() {
        itemsDelPedidoElement.innerHTML = '';
        let totalAcumulado = 0;
        let totalItems = 0;

        if (itemsCarrito.length === 0) {
            textoCarritoVacio.style.display = 'block';
        } else {
            textoCarritoVacio.style.display = 'none';
        }

        itemsCarrito.forEach(item => {
            const subtotal = item.cantidad * item.precio;
            totalAcumulado += subtotal;
            totalItems += item.cantidad;

            const div = document.createElement('div');
            div.className = 'd-flex justify-content-between align-items-center border-bottom py-2';
            div.innerHTML = `
                <div class="flex-grow-1">
                    <small class="d-block">${item.nombre}</small>
                    <span class="font-weight-bold text-dark">${formatter.format(subtotal)}</span>
                    <small class="text-muted"> (${item.cantidad} x ${formatter.format(item.precio)})</small>
                </div>
                <div class="btn-group btn-group-sm" role="group">
                    <button type="button" class="btn btn-outline-danger" onclick="cambiarCantidad(${item.id}, -1)">-</button>
                    <button type="button" class="btn btn-outline-secondary" disabled>${item.cantidad}</button>
                    <button type="button" class="btn btn-outline-success" onclick="cambiarCantidad(${item.id}, 1)">+</button>
                </div>
                <button type="button" class="btn btn-sm btn-light text-danger ml-2" onclick="eliminarArticulo(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            itemsDelPedidoElement.appendChild(div);
        });

        totalAcumuladoElement.textContent = formatter.format(totalAcumulado);
        contadorItemsElement.textContent = totalItems;
        document.getElementById('contador-items-flotante').textContent = totalItems;

        btnGuardarPedido.disabled = totalItems === 0 || mesaSeleccionadaId === null;
        btnGuardarPedido.textContent = pedidoIdEditando.value ? 'Actualizar Pedido' : 'Guardar Pedido';
        
        // Mostrar u ocultar botón flotante en móvil
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            const btnToggleCarrito = document.getElementById('btn-toggle-carrito');
            btnToggleCarrito.style.display = totalItems > 0 ? 'block' : 'none';
        }
    }

    async function guardarPedido() {
        const total = itemsCarrito.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
        const pedidoData = {
            mesa_id: mesaSeleccionadaId,
            items: itemsCarrito.map(item => ({
                id: item.id,
                nombre: item.nombre,
                precio: item.precio,
                cantidad: item.cantidad
            })),
            total: total.toFixed(2),
            pedido_id: pedidoIdEditando.value || null
        };
        
        const result = await apiFetch('pedidos', 'POST', pedidoData);
        
        if (result.success) {
            alert(result.message);
            // Limpiar y resetear
            itemsCarrito = [];
            mesaSeleccionadaId = null;
            pedidoIdEditando.value = '';
            
            cargarTodo();
        }
    }

    async function cargarPedidoParaEditar(id) {
        const result = await apiFetch(`pedidos/${id}`);
        // El endpoint de detalle sí devuelve un objeto con la clave 'success'
        if (result.success) {
            const pedido = result.pedido;
            
            // 1. Cargar datos del pedido
            pedidoIdEditando.value = pedido.id;
            
            // 2. Seleccionar la mesa
            seleccionarMesa(pedido.proveedor_id, pedido.mesa_nombre);
            
            // 3. Cargar ítems al carrito (Necesitamos el stock original)
            itemsCarrito = pedido.items.map(item => {
                const articuloOriginal = articulosDisponibles.find(a => a.id === item.articulo_id);
                return {
                    id: item.articulo_id,
                    nombre: item.nombre,
                    precio: item.precio,
                    cantidad: item.cantidad,
                    stock: articuloOriginal ? articuloOriginal.stock : 999 // Fallback si el artículo fue eliminado
                };
            });
            
            // 4. Renderizar el carrito y cambiar a la pestaña de pedidos
            renderizarCarrito();
            
            $('#pedidos-tab').tab('show');
            toggleCarrito(true); // Mostrar carrito en móvil
        }
    }

    async function eliminarPedido(id) {
        if (!confirm(`¿Estás seguro de eliminar el Pedido ID #${id}? Esta acción es irreversible.`)) return;

        const result = await apiFetch(`pedidos/${id}`, 'DELETE');
        
        if (result.success) {
            alert(result.message);
            cargarHistorialPedidos();
        }
    }

    // --- LÓGICA DE HISTORIAL/REPORTES ---

    async function cargarHistorialPedidos(filtros = {}) {
        listaHistorial.innerHTML = '<tr><td colspan="6" class="text-center">Cargando pedidos...</td></tr>';

        const params = new URLSearchParams(filtros).toString();
        const result = await apiFetch(`pedidos?${params}`);

        listaHistorial.innerHTML = '';
        // CORRECCIÓN: Para las rutas GET que devuelven un array directamente, solo revisamos que sea un array
        if (Array.isArray(result)) { 
            if (result.length === 0) {
                listaHistorial.innerHTML = '<tr><td colspan="6" class="text-center">No se encontraron pedidos con los filtros aplicados.</td></tr>';
                return;
            }

            result.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${p.id}</td>
                    <td>${new Date(p.fecha).toLocaleString()}</td>
                    <td>${p.mesa_nombre}</td>
                    <td>${formatter.format(p.total)}</td>
                    <td><span class="badge badge-${p.estado === 'COMPLETADO' ? 'success' : 'warning'}">${p.estado}</span></td>
                    <td>
                        <button class="btn btn-sm btn-info mr-1" onclick="mostrarDetallePedido(${p.id})"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-sm btn-warning mr-1" onclick="cargarPedidoParaEditar(${p.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="eliminarPedido(${p.id})"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                listaHistorial.appendChild(tr);
            });
        } else {
            listaHistorial.innerHTML = '<tr><td colspan="6" class="text-center">Error al cargar historial.</td></tr>';
        }
    }

    async function mostrarDetallePedido(id) {
        const modalBody = document.getElementById('modalDetallePedidoBody');
        modalBody.innerHTML = 'Cargando detalle...';
        
        const result = await apiFetch(`pedidos/${id}`);
        
        if (result.success) {
            const pedido = result.pedido;
            let itemsHtml = `
                <p><strong>ID Pedido:</strong> ${pedido.id}</p>
                <p><strong>Mesa:</strong> ${pedido.mesa_nombre}</p>
                <p><strong>Fecha:</strong> ${new Date(pedido.fecha).toLocaleString()}</p>
                <p><strong>Estado:</strong> <span class="badge badge-${pedido.estado === 'COMPLETADO' ? 'success' : 'warning'}">${pedido.estado}</span></p>
                <hr>
                <h6>Detalle de Ítems:</h6>
                <ul class="list-group">
            `;

            pedido.items.forEach(item => {
                itemsHtml += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        ${item.nombre} (${item.cantidad} x ${formatter.format(item.precio)})
                        <span class="badge badge-primary badge-pill">${formatter.format(item.cantidad * item.precio)}</span>
                    </li>
                `;
            });
            
            itemsHtml += `</ul><h5 class="mt-3 text-right">Total: ${formatter.format(pedido.total)}</h5>`;
            modalBody.innerHTML = itemsHtml;
            $('#modalDetallePedido').modal('show');
        } else {
            modalBody.innerHTML = `<p class="text-danger">${result.message}</p>`;
        }
    }
    
    // --- LÓGICA DE INVENTARIO/ARTÍCULOS ---

    function renderizarArticulosInventario() {
        listaArticulosInventario.innerHTML = '';
        if (articulosDisponibles.length === 0) {
            listaArticulosInventario.innerHTML = '<tr><td colspan="6" class="text-center">No hay artículos cargados.</td></tr>';
            return;
        }
        
        articulosDisponibles.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${a.id}</td>
                <td>${a.nombre}</td>
                <td>${formatter.format(a.precio)}</td>
                <td>${a.stock}</td>
                <td>${a.categoria_nombre}</td>
                <td>
                    <button class="btn btn-sm btn-warning mr-1" onclick="cargarArticuloParaEditar(${a.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarArticuloInventario(${a.id})"><i class="fas fa-trash"></i></button>
                </td>
            `;
            listaArticulosInventario.appendChild(tr);
        });
    }

    function cargarArticuloParaEditar(id) {
        const articulo = articulosDisponibles.find(a => a.id === id);
        if (articulo) {
            document.getElementById('articuloId').value = articulo.id;
            document.getElementById('articuloNombre').value = articulo.nombre;
            document.getElementById('articuloPrecio').value = articulo.precio;
            document.getElementById('articuloStock').value = articulo.stock;
            document.getElementById('articuloCategoria').value = articulo.categoria_id;

            document.getElementById('tituloFormArticulo').textContent = 'Editar Artículo';
            document.getElementById('btnGuardarArticulo').textContent = 'Actualizar Artículo';
            btnCancelarEdicionArticulo.style.display = 'block';
        }
    }

    function resetFormArticulo() {
        formArticulo.reset();
        articuloIdInput.value = '';
        document.getElementById('tituloFormArticulo').textContent = 'Nuevo Artículo';
        document.getElementById('btnGuardarArticulo').textContent = 'Guardar Artículo';
        btnCancelarEdicionArticulo.style.display = 'none';
    }

    async function guardarArticulo(e) {
        e.preventDefault();
        
        const id = articuloIdInput.value;
        const url = id ? `articulos/${id}` : 'articulos';
        const method = id ? 'PUT' : 'POST';
        
        const data = {
            nombre: document.getElementById('articuloNombre').value,
            precio: parseFloat(document.getElementById('articuloPrecio').value),
            stock: parseInt(document.getElementById('articuloStock').value),
            categoria_id: parseInt(document.getElementById('articuloCategoria').value)
        };

        const result = await apiFetch(url, method, data);

        if (result.success) {
            alert(result.message);
            resetFormArticulo();
            cargarTodo();
        }
    }

    async function eliminarArticuloInventario(id) {
        if (!confirm(`¿Estás seguro de eliminar el Artículo ID #${id}?`)) return;

        const result = await apiFetch(`articulos/${id}`, 'DELETE');
        
        if (result.success) {
            alert(result.message);
            cargarTodo();
        }
    }

    // --- LÓGICA DE TABLAS BASE ---

    function renderizarProveedores() {
        listaProveedores.innerHTML = '';
        if (proveedoresDisponibles.length === 0) {
            listaProveedores.innerHTML = '<tr><td colspan="3" class="text-center">No hay mesas cargadas.</td></tr>';
            return;
        }

        proveedoresDisponibles.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.id}</td>
                <td>${p.nombre}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="eliminarProveedor(${p.id})"><i class="fas fa-trash"></i></button>
                </td>
            `;
            listaProveedores.appendChild(tr);
        });
    }

    async function guardarProveedor(e) {
        e.preventDefault();
        const nombre = document.getElementById('proveedorNombre').value;

        const result = await apiFetch('proveedores', 'POST', { nombre: nombre });

        if (result.success) {
            alert(result.message);
            formProveedor.reset();
            cargarTodo();
        }
    }

    async function eliminarProveedor(id) {
        if (!confirm(`¿Estás seguro de eliminar la Mesa ID #${id}?`)) return;
        
        const result = await apiFetch(`proveedores/${id}`, 'DELETE');
        
        if (result.success) {
            alert(result.message);
            cargarTodo();
        }
    }

    function renderizarCategoriasInventario() {
        listaCategoriasInventario.innerHTML = '';
        articuloCategoriaSelect.innerHTML = ''; // Limpiar select de artículos
        
        if (categoriasDisponibles.length === 0) {
            listaCategoriasInventario.innerHTML = '<tr><td colspan="3" class="text-center">No hay categorías cargadas.</td></tr>';
            return;
        }

        categoriasDisponibles.forEach(c => {
            // Tabla de categorías
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${c.id}</td>
                <td>${c.nombre}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="eliminarCategoria(${c.id})"><i class="fas fa-trash"></i></button>
                </td>
            `;
            listaCategoriasInventario.appendChild(tr);

            // Select de artículos
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.nombre;
            articuloCategoriaSelect.appendChild(option);
        });
        
        // Inicializar la categoría seleccionada para el menú
        if (categoriasDisponibles.length > 0 && categoriaSeleccionadaId) {
             // Asegura que la categoría inicial esté seleccionada
             categoriaSeleccionadaId = categoriasDisponibles.find(c => c.id === categoriaSeleccionadaId) ? categoriaSeleccionadaId : categoriasDisponibles[0].id;
        } else if (categoriasDisponibles.length > 0) {
            categoriaSeleccionadaId = categoriasDisponibles[0].id;
        }
        
    }

    async function guardarCategoria(e) {
        e.preventDefault();
        const nombre = document.getElementById('categoriaNombre').value;

        const result = await apiFetch('categorias', 'POST', { nombre: nombre });

        if (result.success) {
            alert(result.message);
            formCategoria.reset();
            cargarTodo();
        }
    }

    async function eliminarCategoria(id) {
        if (!confirm(`¿Estás seguro de eliminar la Categoría ID #${id}? Se deben eliminar primero todos los artículos asociados.`)) return;
        
        const result = await apiFetch(`categorias/${id}`, 'DELETE');
        
        if (result.success) {
            alert(result.message);
            cargarTodo();
        }
    }
    
    // --- FUNCIONES DE ESTADÍSTICAS (NUEVAS) ---

    async function cargarEstadisticas() {
        try {
            // Evitar recargar si ya hay datos y el gráfico fue dibujado (optimización simple)
            if (window.graficoVentasDiariasInstance) {
                window.graficoVentasDiariasInstance.destroy();
            }
            if (window.graficoVentasPorCategoriaInstance) {
                window.graficoVentasPorCategoriaInstance.destroy();
            }

            const result = await apiFetch('estadisticas');
            // La ruta /api/estadisticas SÍ devuelve {success: true, data: ...}
            if (!result.success) { 
                throw new Error(result.message || 'Error al obtener las estadísticas.');
            }
            const data = result.data;

            // Renderizar todos los componentes
            renderizarComparativaMensual(data.comparativaMes);
            renderizarGraficoVentasDiarias(data.ventasDiarias);
            renderizarGraficoVentasPorCategoria(data.ventasPorCategoria);
            renderizarTablaTopProductos(data.topProductos, 'tablaTopProductos');
            renderizarTablaTopProductos(data.menosVendidos, 'tablaMenosVendidos');

        } catch (error) {
            console.error("Error al cargar estadísticas:", error);
            document.getElementById('comparativa-mes-actual').textContent = 'Error';
            document.getElementById('tablaTopProductos').innerHTML = '<tr><td colspan="4">Error al cargar datos.</td></tr>';
        }
    }

    function renderizarComparativaMensual(data) {
        const formatterLocal = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }); 
        const mesActualEl = document.getElementById('comparativa-mes-actual');
        const mesAnteriorEl = document.getElementById('comparativa-mes-anterior');
        const porcentajeEl = document.getElementById('comparativa-porcentaje');

        const actual = parseFloat(data.mesActual);
        const anterior = parseFloat(data.mesAnterior);

        mesActualEl.textContent = formatterLocal.format(actual);
        mesAnteriorEl.textContent = formatterLocal.format(anterior);

        let porcentaje;
        if (anterior > 0) {
            porcentaje = ((actual - anterior) / anterior) * 100;
        } else if (actual > 0 && anterior === 0) {
            porcentaje = 100; // Si el mes anterior fue 0 y este no lo es
        } else {
            porcentaje = 0;
        }

        porcentajeEl.textContent = `${porcentaje.toFixed(2)}%`;

        // Lógica de color según el cambio
        porcentajeEl.classList.remove('text-success', 'text-danger', 'text-warning');
        if (porcentaje > 0) {
            porcentajeEl.classList.add('text-success');
        } else if (porcentaje < 0) {
            porcentajeEl.classList.add('text-danger');
        } else {
            porcentajeEl.classList.add('text-warning');
        }
    }


    function renderizarGraficoVentasDiarias(datos) {
        const ctx = document.getElementById('graficoVentasDiarias').getContext('2d');
        const labels = datos.map(d => d.dia);
        const data = datos.map(d => d.total_ventas);

        // Destruir instancia anterior si existe
        if (window.graficoVentasDiariasInstance) {
            window.graficoVentasDiariasInstance.destroy();
        }
        
        window.graficoVentasDiariasInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Venta Diaria',
                    data: data,
                    backgroundColor: 'rgba(220, 53, 69, 0.5)',
                    borderColor: 'rgba(220, 53, 69, 1)',
                    borderWidth: 2,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero: true,
                            callback: function(value, index, values) {
                                return 'S/ ' + value.toLocaleString('es-PE');
                            }
                        }
                    }]
                },
                tooltips: {
                    callbacks: {
                        label: function(tooltipItem, data) {
                            return data.datasets[tooltipItem.datasetIndex].label + ': S/ ' + tooltipItem.yLabel.toLocaleString('es-PE');
                        }
                    }
                }
            }
        });
    }

    function renderizarGraficoVentasPorCategoria(datos) {
        const ctx = document.getElementById('graficoVentasPorCategoria').getContext('2d');
        const labels = datos.map(d => d.categoria);
        const data = datos.map(d => d.total_vendido);
        const backgroundColors = [
            '#dc3545', // Rojo (Pollo)
            '#ffc107', // Amarillo (Guarniciones)
            '#007bff', // Azul (Bebidas)
            '#28a745', // Verde (Combos)
            '#6c757d', // Gris (Otros)
            '#fd7e14' // Naranja
        ];

        // Destruir instancia anterior si existe
        if (window.graficoVentasPorCategoriaInstance) {
            window.graficoVentasPorCategoriaInstance.destroy();
        }

        window.graficoVentasPorCategoriaInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors.slice(0, labels.length),
                    hoverBackgroundColor: backgroundColors.slice(0, labels.length)
                }]
            },
            options: {
                responsive: true,
                    tooltips: {
                        callbacks: {
                            label: function(tooltipItem, data) {
                                const label = data.labels[tooltipItem.index] || '';
                                const value = data.datasets[0].data[tooltipItem.index];
                                return `${label}: S/ ${value.toLocaleString('es-PE')}`;
                            }
                        }
                    }
                }
            });
    }

    function renderizarTablaTopProductos(productos, elementId) {
        const tbody = document.getElementById(elementId);
        if (!tbody) return;

        if (productos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No hay datos disponibles.</td></tr>';
            return;
        }

        tbody.innerHTML = productos.map((p, index) => {
            const ingresos = parseFloat(p.ingresos_totales);
            const cantidad = parseInt(p.cantidad_vendida, 10);
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${p.producto}</td>
                    <td>${cantidad}</td>
                    <td>S/ ${ingresos.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    }

    // --- CARGA INICIAL DE DATOS ---

    async function cargarTodo() {
        // Cargar Tablas Base (Categorías y Mesas)
        const [categoriasResult, proveedoresResult] = await Promise.all([
            apiFetch('categorias'),
            apiFetch('proveedores')
        ]);
        
        // CORRECCIÓN: Revisar si la respuesta es un array (GET devuelve arrays)
        if (Array.isArray(categoriasResult)) {
            categoriasDisponibles = categoriasResult;
            renderizarCategoriasInventario();
            renderizarCategorias();
        }
        
        // CORRECCIÓN: Revisar si la respuesta es un array (GET devuelve arrays)
        if (Array.isArray(proveedoresResult)) {
            proveedoresDisponibles = proveedoresResult;
            renderizarProveedores();
            renderizarMesas();
            // Llenar select de filtros de reportes
            filtroMesaSelect.innerHTML = '<option value="">Todas las Mesas</option>' + proveedoresDisponibles.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
        }

        // Cargar Artículos
        await cargarArticulos(true); // Cargar todos para el inventario
        
        // Cargar Historial
        cargarHistorialPedidos();
        
        // Renderizar carrito inicial
        renderizarCarrito();
    }
    
    // Carga de artículos con o sin filtro de categoría
    async function cargarArticulos(cargarTodos = false) {
        const url = cargarTodos ? 'articulos' : `articulos?categoria_id=${categoriaSeleccionadaId}`;
        const result = await apiFetch(url);

        // CORRECCIÓN: Revisar si la respuesta es un array (GET devuelve arrays)
        if (Array.isArray(result)) {
            // Si cargamos todos, actualizamos la lista global para inventario/carrito.
            if (cargarTodos) {
                articulosDisponibles = result;
                renderizarArticulosInventario();
            }
            
            // Renderizar los artículos del menú (filtrados por categoría seleccionada)
            renderizarArticulos();
        }
    }


    // --- INICIALIZACIÓN Y EVENTOS ---

    function inicializarEventos() {
        // Eventos de Navegación
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => toggleCarrito(false));
        });
        
        // Evento para cargar estadísticas cuando se activa la pestaña
        const estadisticasTab = document.getElementById('estadisticas-tab');
        if (estadisticasTab) {
            estadisticasTab.addEventListener('click', () => {
                cargarEstadisticas(); 
                toggleCarrito(false);
            });
        }
        
        // Eventos de Pedidos
        btnGuardarPedido.addEventListener('click', guardarPedido);

        // Eventos de Inventario
        formArticulo.addEventListener('submit', guardarArticulo);
        btnCancelarEdicionArticulo.addEventListener('click', resetFormArticulo);

        // Eventos de Tablas Base
        formProveedor.addEventListener('submit', guardarProveedor);
        formCategoria.addEventListener('submit', guardarCategoria);

        // Eventos de Reportes
        btnFiltrarHistorial.addEventListener('click', () => {
            const filtros = {
                fecha_inicio: document.getElementById('filtroFechaInicio').value,
                fecha_fin: document.getElementById('filtroFechaFin').value,
                mesa_id: document.getElementById('filtroMesa').value,
            };
            cargarHistorialPedidos(filtros);
        });
        
        btnExportarCSV.addEventListener('click', () => {
            const fecha_inicio = document.getElementById('filtroFechaInicio').value;
            const fecha_fin = document.getElementById('filtroFechaFin').value;
            const mesa_id = document.getElementById('filtroMesa').value;
            
            const params = new URLSearchParams({ fecha_inicio, fecha_fin, mesa_id }).toString();
            window.location.href = `${PYTHON_SERVER_URL}exportar/pedidos?${params}`;
        });
        
        // Lógica de móvil (ocultar/mostrar carrito)
        const btnToggleCarrito = document.getElementById('btn-toggle-carrito');
        const carritoCol = document.getElementById('carrito-col');
        
        function toggleCarrito(show) {
            const isMobile = window.innerWidth < 768;
            if (!isMobile) return;
            
            if (show) {
                carritoCol.classList.remove('d-none', 'd-md-block');
                btnToggleCarrito.style.display = 'none';
            } else {
                carritoCol.classList.add('d-none', 'd-md-block');
                if(itemsCarrito.length > 0) {
                    btnToggleCarrito.style.display = 'block';
                } else {
                    btnToggleCarrito.style.display = 'none';
                }
            }
        }
        
        window.addEventListener('resize', () => toggleCarrito(false));
        
        if (btnToggleCarrito) {
            btnToggleCarrito.addEventListener('click', () => toggleCarrito(true));
        }
        
        // Exponer funciones al scope global (window)
        window.agregarAlCarrito = agregarAlCarrito;
        window.cambiarCantidad = cambiarCantidad;
        window.eliminarArticulo = eliminarArticulo;
        window.eliminarProveedor = eliminarProveedor;
        window.eliminarCategoria = eliminarCategoria;
        window.cargarArticuloParaEditar = cargarArticuloParaEditar;
        window.eliminarArticuloInventario = eliminarArticuloInventario;
        window.mostrarDetallePedido = mostrarDetallePedido;
        window.cargarPedidoParaEditar = cargarPedidoParaEditar;
        window.eliminarPedido = eliminarPedido; 
    }

    // --- INICIALIZACIÓN ---
    inicializarEventos();
    cargarTodo();
});