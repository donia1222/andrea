// ===== Coste de Menús — lógica de la app (sin dependencias) =====
// Los datos se guardan en el navegador con localStorage, bajo esta clave:
const CLAVE = "coste-menus:v1";
const MONEDA = "CHF";

// --- Unidades y conversión ---------------------------------------------------
// Cada unidad pertenece a una "familia" y se expresa en un factor respecto a la
// unidad base de su familia (peso → kg, volumen → L, unidades → ud).
const UNIDADES = {
  g:  { etiqueta: "g",  familia: "peso",   factor: 0.001 }, // 1 g = 0.001 kg
  kg: { etiqueta: "kg", familia: "peso",   factor: 1 },
  ml: { etiqueta: "ml", familia: "volumen", factor: 0.001 }, // 1 ml = 0.001 L
  L:  { etiqueta: "L",  familia: "volumen", factor: 1 },
  ud: { etiqueta: "ud", familia: "unidad",  factor: 1 },
};

// Coste de un ingrediente.
// precio = precio de compra; unidadPrecio = a cuánto corresponde ese precio
// cantidad = cuánto se usa en el plato; unidadCant = unidad de esa cantidad.
function costeIngrediente(ing) {
  const up = UNIDADES[ing.unidadPrecio];
  const uc = UNIDADES[ing.unidadCant];
  const precio = Number(ing.precio) || 0;
  const cantidad = Number(ing.cantidad) || 0;
  if (!up || !uc || up.familia !== uc.familia) return 0;
  // precio por unidad base (p. ej. CHF por kg)
  const precioPorBase = precio / up.factor;
  // cantidad usada en unidad base (p. ej. kg)
  const cantidadBase = cantidad * uc.factor;
  return precioPorBase * cantidadBase;
}

function costeTotal(plato) {
  return (plato.ingredientes || []).reduce((s, ing) => s + costeIngrediente(ing), 0);
}

const fmt = (n) => `${(Number(n) || 0).toFixed(2)} ${MONEDA}`;

// --- Almacenamiento ----------------------------------------------------------
function cargarPlatos() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || [];
  } catch {
    return [];
  }
}
function guardarPlatos(p) {
  localStorage.setItem(CLAVE, JSON.stringify(p));
}
const CLAVE_CAT = "coste-menus:categorias:v1";
function cargarCategorias() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_CAT)) || [];
  } catch {
    return [];
  }
}
function guardarCategorias() {
  localStorage.setItem(CLAVE_CAT, JSON.stringify(categorias));
}
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// --- Estado en memoria -------------------------------------------------------
let platos = cargarPlatos();
let categorias = cargarCategorias(); // [{ id, nombre, platoIds: [] }]
let actual = null;          // plato que se está creando/editando (copia de trabajo)
let categoriaActual = null; // "todos", id de categoría, o null (rejilla)

// --- Referencias al DOM ------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const lista = $("#lista-platos");
const cuerpoIng = $("#cuerpo-ing");
const inputNombre = $("#nombre-plato");
const inputBuscar = $("#buscar");
const fotoInput = $("#foto-input");
const fotoCaja = $("#foto-caja");
const fotoPreview = $("#foto-preview");
const fotoPlaceholder = $("#foto-placeholder");
const btnQuitarFoto = $("#btn-quitar-foto");

// --- Navegación entre vistas (pestañas) -------------------------------------
function mostrarVista(nombre) {
  $("#vista-crear").hidden = nombre !== "crear";
  $("#vista-historial").hidden = nombre !== "historial";
  $("#tab-crear").classList.toggle("active", nombre === "crear");
  $("#tab-historial").classList.toggle("active", nombre === "historial");
}

// --- Imagen ------------------------------------------------------------------
// Reduce y comprime la imagen elegida a un máximo de 600 px (lado mayor) y la
// devuelve como data URL (JPEG), para que ocupe poco en localStorage.
function procesarImagen(file, maxLado = 600) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxLado) {
          height = Math.round((height * maxLado) / width);
          width = maxLado;
        } else if (height > maxLado) {
          width = Math.round((width * maxLado) / height);
          height = maxLado;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = lector.result;
    };
    lector.onerror = reject;
    lector.readAsDataURL(file);
  });
}

// Pinta (o limpia) la vista previa de la foto del plato en edición.
function renderFoto() {
  const foto = actual?.foto;
  if (foto) {
    fotoPreview.src = foto;
    fotoPreview.hidden = false;
    fotoPlaceholder.hidden = true;
    btnQuitarFoto.hidden = false;
    fotoCaja.classList.add("con-foto");
  } else {
    fotoPreview.removeAttribute("src");
    fotoPreview.hidden = true;
    fotoPlaceholder.hidden = false;
    btnQuitarFoto.hidden = true;
    fotoCaja.classList.remove("con-foto");
  }
}

// --- Historial: rejilla de categorías ----------------------------------------
// Devuelve los platos que pertenecen a una categoría (id="todos" => todos).
function platosDe(catId) {
  if (catId === "todos") return platos;
  const c = categorias.find((x) => x.id === catId);
  return c ? platos.filter((p) => c.platoIds.includes(p.id)) : [];
}

function tarjetaCategoria(catId, nombre, ps) {
  const card = document.createElement("button");
  card.className = "cat-card";
  const foto = ps.find((p) => p.foto)?.foto;
  if (foto) {
    card.classList.add("con-foto");
    card.style.backgroundImage = `linear-gradient(180deg, rgba(15,23,42,.15), rgba(15,23,42,.72)), url("${foto}")`;
  }
  const n = ps.length;
  card.innerHTML = `
    ${foto ? "" : `<svg class="ic ic-lg cat-card-icono"><use href="#i-list"/></svg>`}
    <span class="cat-card-pie">
      <span class="cat-card-nombre"></span>
      <span class="cat-card-num">${n} ${n === 1 ? "plato" : "platos"}</span>
    </span>`;
  card.querySelector(".cat-card-nombre").textContent = nombre;
  card.addEventListener("click", () => abrirCategoria(catId));
  return card;
}

function renderCategorias() {
  const grid = $("#cat-grid");
  grid.innerHTML = "";
  grid.appendChild(tarjetaCategoria("todos", "Todos", platos));
  for (const c of categorias) {
    grid.appendChild(tarjetaCategoria(c.id, c.nombre, platosDe(c.id)));
  }
  // Tarjeta para crear una nueva categoría
  const nueva = document.createElement("button");
  nueva.className = "cat-card cat-card-nueva";
  nueva.innerHTML = `<svg class="ic ic-lg"><use href="#i-plus"/></svg><span>Nueva categoría</span>`;
  nueva.addEventListener("click", crearCategoria);
  grid.appendChild(nueva);
}

function crearCategoria() {
  const nombre = prompt("Nombre de la nueva categoría:");
  if (!nombre || !nombre.trim()) return;
  categorias.push({ id: nuevoId(), nombre: nombre.trim(), platoIds: [] });
  guardarCategorias();
  renderCategorias();
}

function abrirCategoria(catId) {
  categoriaActual = catId;
  $("#cat-grid-vista").hidden = true;
  $("#cat-detalle-vista").hidden = false;
  const nombre = catId === "todos" ? "Todos" : (categorias.find((c) => c.id === catId)?.nombre || "");
  $("#cat-detalle-titulo").textContent = nombre;
  $("#btn-add-platos").hidden = catId === "todos";   // en "Todos" no se añade manualmente
  $("#btn-eliminar-cat").hidden = catId === "todos"; // "Todos" no se puede eliminar
  inputBuscar.value = "";
  renderLista();
}

function volverACategorias() {
  categoriaActual = null;
  $("#cat-detalle-vista").hidden = true;
  $("#cat-grid-vista").hidden = false;
  renderCategorias();
}

// --- Historial: lista de platos de la categoría abierta ----------------------
function renderLista() {
  if (!categoriaActual) return; // estamos en la rejilla, nada que listar
  const filtro = inputBuscar.value.trim().toLowerCase();
  lista.innerHTML = "";
  const base = platosDe(categoriaActual);
  const enTodos = categoriaActual === "todos";

  const vacio = $("#historial-vacio");
  vacio.hidden = base.length !== 0;
  $("#btn-vacio-crear").hidden = !enTodos;            // el botón "crear" sólo en Todos
  $("#historial-vacio-txt").textContent = enTodos
    ? "Aún no has guardado ningún plato."
    : "Esta categoría está vacía. Añade platos con el botón de abajo.";
  $(".buscador").hidden = base.length === 0;

  const visibles = base.filter((p) => p.nombre.toLowerCase().includes(filtro));
  for (const p of visibles) {
    const li = document.createElement("li");
    const mini = p.foto
      ? `<img class="miniatura" src="${p.foto}" alt="">`
      : `<div class="miniatura vacia"><svg class="ic"><use href="#i-image"/></svg></div>`;
    li.innerHTML = `${mini}
      <span class="info">
        <span class="nombre"></span>
        <span class="coste">${fmt(costeTotal(p))}</span>
      </span>
      <button class="btn-borrar-plato" title="${enTodos ? "Eliminar plato" : "Quitar de la categoría"}"><svg class="ic ic-sm"><use href="#i-trash"/></svg></button>`;
    li.querySelector(".nombre").textContent = p.nombre || "(sin nombre)";
    li.addEventListener("click", () => abrirPlato(p.id));
    li.querySelector(".btn-borrar-plato").addEventListener("click", (e) => {
      e.stopPropagation();
      if (enTodos) eliminarPlato(p.id);
      else quitarDeCategoria(p.id);
    });
    lista.appendChild(li);
  }
}

// Quita un plato de la categoría abierta (no lo borra de "Todos").
function quitarDeCategoria(platoId) {
  const c = categorias.find((x) => x.id === categoriaActual);
  if (!c) return;
  c.platoIds = c.platoIds.filter((id) => id !== platoId);
  guardarCategorias();
  renderLista();
}

// Elimina la categoría abierta (no borra los platos, sólo la categoría).
function eliminarCategoria() {
  if (!categoriaActual || categoriaActual === "todos") return; // "Todos" no se elimina
  const c = categorias.find((x) => x.id === categoriaActual);
  if (!c) return;
  if (!confirm(`¿Eliminar la categoría "${c.nombre}"? Los platos no se borran, sólo la categoría.`)) return;
  categorias = categorias.filter((x) => x.id !== categoriaActual);
  guardarCategorias();
  volverACategorias();
}

// --- Modal para añadir platos a la categoría abierta -------------------------
function abrirModalAdd() {
  const c = categorias.find((x) => x.id === categoriaActual);
  if (!c) return;
  const disponibles = platos.filter((p) => !c.platoIds.includes(p.id));
  const ul = $("#modal-lista");
  ul.innerHTML = "";
  $("#modal-vacio").hidden = disponibles.length > 0;
  for (const p of disponibles) {
    const li = document.createElement("li");
    li.className = "modal-item";
    const mini = p.foto
      ? `<img class="miniatura" src="${p.foto}" alt="">`
      : `<div class="miniatura vacia"><svg class="ic"><use href="#i-image"/></svg></div>`;
    li.innerHTML = `
      <input type="checkbox" value="${p.id}">
      ${mini}
      <span class="nombre"></span>
      <span class="coste">${fmt(costeTotal(p))}</span>`;
    li.querySelector(".nombre").textContent = p.nombre || "(sin nombre)";
    li.addEventListener("click", (e) => {
      if (e.target.tagName !== "INPUT") {
        const chk = li.querySelector("input");
        chk.checked = !chk.checked;
      }
    });
    ul.appendChild(li);
  }
  $("#modal-add").hidden = false;
}

function cerrarModalAdd() {
  $("#modal-add").hidden = true;
}

function confirmarAdd() {
  const c = categorias.find((x) => x.id === categoriaActual);
  if (!c) return cerrarModalAdd();
  const marcados = [...document.querySelectorAll("#modal-lista input:checked")].map((i) => i.value);
  for (const id of marcados) {
    if (!c.platoIds.includes(id)) c.platoIds.push(id);
  }
  guardarCategorias();
  cerrarModalAdd();
  renderLista();
}

// --- Editor ------------------------------------------------------------------
function opcionesUnidad(sel) {
  return Object.entries(UNIDADES)
    .map(([k, u]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${u.etiqueta}</option>`)
    .join("");
}

function renderIngredientes() {
  document.querySelector(".tabla-wrap").hidden = actual.ingredientes.length === 0;
  cuerpoIng.innerHTML = "";
  actual.ingredientes.forEach((ing, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Ingrediente"><input class="input nombre" type="text" placeholder="Ej.: Pollo" value="${escapar(ing.nombre)}"></td>
      <td data-label="Precio compra"><input class="input precio" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0" value="${ing.precio ?? ""}"></td>
      <td data-label="por"><select class="up">${opcionesUnidad(ing.unidadPrecio)}</select></td>
      <td data-label="Cantidad usada"><input class="input cant" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0" value="${ing.cantidad ?? ""}"></td>
      <td data-label="unidad"><select class="uc">${opcionesUnidad(ing.unidadCant)}</select></td>
      <td data-label="Coste" class="num celda-coste">${fmt(costeIngrediente(ing))}</td>
      <td class="fila-borrar"><button class="btn-borrar-fila" title="Eliminar ingrediente"><svg class="ic ic-sm"><use href="#i-trash"/></svg> Eliminar</button></td>
    `;

    tr.querySelector(".nombre").addEventListener("input", (e) => { ing.nombre = e.target.value; });
    tr.querySelector(".precio").addEventListener("input", (e) => { ing.precio = e.target.value; recalcular(); });
    tr.querySelector(".cant").addEventListener("input", (e) => { ing.cantidad = e.target.value; recalcular(); });
    tr.querySelector(".up").addEventListener("change", (e) => { ing.unidadPrecio = e.target.value; renderIngredientes(); recalcular(); });
    tr.querySelector(".uc").addEventListener("change", (e) => { ing.unidadCant = e.target.value; renderIngredientes(); recalcular(); });
    tr.querySelector(".btn-borrar-fila").addEventListener("click", () => {
      actual.ingredientes.splice(i, 1);
      renderIngredientes();
      recalcular();
    });
    cuerpoIng.appendChild(tr);
  });
}

// Recalcula totales y refresca sólo las celdas de coste (sin reconstruir inputs).
function recalcular() {
  const filas = cuerpoIng.querySelectorAll("tr");
  actual.ingredientes.forEach((ing, i) => {
    const celda = filas[i]?.querySelector(".celda-coste");
    if (celda) celda.textContent = fmt(costeIngrediente(ing));
  });
  $("#coste-total").textContent = fmt(costeTotal(actual));
}

function ingredienteVacio() {
  return { nombre: "", precio: "", unidadPrecio: "kg", cantidad: "", unidadCant: "g" };
}

function cargarEnEditor(plato, titulo) {
  actual = plato;
  if (actual.foto === undefined) actual.foto = null;
  $("#editor-titulo").textContent = titulo;
  inputNombre.value = actual.nombre;
  $("#btn-eliminar").hidden = !actual.id;
  $("#aviso-guardado").textContent = "";
  renderFoto();
  renderIngredientes();
  recalcular();
}

// Pestaña "Crear plato": siempre empieza un plato nuevo y vacío.
function nuevoPlato() {
  cargarEnEditor({ id: null, nombre: "", foto: null, ingredientes: [] }, "Nuevo plato");
  mostrarVista("crear");
  inputNombre.focus();
}

// Abre un plato del historial para editarlo (copia de trabajo).
function abrirPlato(id) {
  const p = platos.find((x) => x.id === id);
  if (!p) return;
  cargarEnEditor(JSON.parse(JSON.stringify(p)), "Editar plato");
  mostrarVista("crear");
}

function guardar() {
  actual.nombre = inputNombre.value.trim() || "(sin nombre)";
  if (actual.id) {
    const i = platos.findIndex((p) => p.id === actual.id);
    if (i !== -1) platos[i] = JSON.parse(JSON.stringify(actual));
  } else {
    actual.id = nuevoId();
    platos.unshift(JSON.parse(JSON.stringify(actual)));
  }
  guardarPlatos(platos);
  actual = null;             // limpia el panel
  irAlHistorial();           // pasa al historial (rejilla de categorías)
}

// "No guardar": descarta los cambios y vuelve al historial.
function cancelar() {
  actual = null;
  irAlHistorial();
}

// Muestra el Historial empezando por la rejilla de categorías.
function irAlHistorial() {
  categoriaActual = null;
  $("#cat-detalle-vista").hidden = true;
  $("#cat-grid-vista").hidden = false;
  renderCategorias();
  mostrarVista("historial");
}

// Eliminar desde el editor (el plato que se está editando).
function eliminar() {
  if (actual?.id) eliminarPlato(actual.id, true);
}

// Eliminar un plato del todo (de "Todos" y de cualquier categoría).
function eliminarPlato(id, desdeEditor = false) {
  const p = platos.find((x) => x.id === id);
  if (!p) return;
  if (!confirm(`¿Eliminar el plato "${p.nombre}"? Se quitará también de sus categorías.`)) return;
  platos = platos.filter((x) => x.id !== id);
  for (const c of categorias) c.platoIds = c.platoIds.filter((x) => x !== id);
  guardarPlatos(platos);
  guardarCategorias();
  if (desdeEditor) {
    actual = null;
    irAlHistorial();
  } else {
    renderLista();
  }
}

function escapar(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// --- Eventos -----------------------------------------------------------------
$("#tab-crear").addEventListener("click", nuevoPlato);
$("#tab-historial").addEventListener("click", irAlHistorial);
$("#btn-vacio-crear").addEventListener("click", nuevoPlato);
$("#btn-volver-cat").addEventListener("click", irAlHistorial);
$("#btn-add-platos").addEventListener("click", abrirModalAdd);
$("#btn-eliminar-cat").addEventListener("click", eliminarCategoria);
$("#modal-cancelar").addEventListener("click", cerrarModalAdd);
$("#modal-aceptar").addEventListener("click", confirmarAdd);
$("#modal-add").addEventListener("click", (e) => { if (e.target.id === "modal-add") cerrarModalAdd(); });
$("#btn-add-ing").addEventListener("click", () => {
  actual.ingredientes.push(ingredienteVacio());
  renderIngredientes();
  recalcular();
});
$("#btn-guardar").addEventListener("click", guardar);
$("#btn-cancelar").addEventListener("click", cancelar);
$("#btn-eliminar").addEventListener("click", eliminar);
fotoCaja.addEventListener("click", () => {
  if (actual) fotoInput.click();
});
fotoInput.addEventListener("change", async () => {
  const file = fotoInput.files?.[0];
  if (!file || !actual) return;
  try {
    actual.foto = await procesarImagen(file);
    renderFoto();
  } catch {
    alert("No se pudo cargar la imagen.");
  }
  fotoInput.value = ""; // permite volver a elegir la misma imagen
});
btnQuitarFoto.addEventListener("click", (e) => {
  e.stopPropagation(); // que no se abra el selector al quitar
  if (!actual) return;
  actual.foto = null;
  renderFoto();
});
inputNombre.addEventListener("input", () => { if (actual) actual.nombre = inputNombre.value; });
inputBuscar.addEventListener("input", renderLista);

// --- Inicio ------------------------------------------------------------------
// Si ya hay platos guardados, abrimos el Historial (rejilla); si no, Crear.
if (platos.length > 0) {
  irAlHistorial();
} else {
  nuevoPlato();
}
