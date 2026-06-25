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
function guardarPlatos(platos) {
  localStorage.setItem(CLAVE, JSON.stringify(platos));
}
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// --- Estado en memoria -------------------------------------------------------
let platos = cargarPlatos();
let actual = null; // plato que se está editando (copia de trabajo)

// --- Referencias al DOM ------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const lista = $("#lista-platos");
const historialVacio = $("#historial-vacio");
const editor = $("#editor");
const bienvenida = $("#bienvenida");
const cuerpoIng = $("#cuerpo-ing");
const inputNombre = $("#nombre-plato");
const inputRaciones = $("#raciones");
const inputBuscar = $("#buscar");

// --- Render del historial ----------------------------------------------------
function renderLista() {
  const filtro = inputBuscar.value.trim().toLowerCase();
  lista.innerHTML = "";
  const visibles = platos.filter((p) => p.nombre.toLowerCase().includes(filtro));
  historialVacio.hidden = platos.length > 0;

  for (const p of visibles) {
    const li = document.createElement("li");
    if (actual && p.id === actual.id) li.classList.add("activo");
    li.innerHTML = `<span class="nombre"></span><span class="coste">${fmt(costeTotal(p))}</span>`;
    li.querySelector(".nombre").textContent = p.nombre || "(sin nombre)";
    li.addEventListener("click", () => abrirPlato(p.id));
    lista.appendChild(li);
  }
}

// --- Editor ------------------------------------------------------------------
function opcionesUnidad(sel) {
  return Object.entries(UNIDADES)
    .map(([k, u]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${u.etiqueta}</option>`)
    .join("");
}

function renderIngredientes() {
  cuerpoIng.innerHTML = "";
  actual.ingredientes.forEach((ing, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input class="input nombre" type="text" placeholder="Ej.: Pollo" value="${escapar(ing.nombre)}"></td>
      <td><input class="input precio" type="number" min="0" step="0.01" placeholder="0" value="${ing.precio ?? ""}"></td>
      <td><select class="up">${opcionesUnidad(ing.unidadPrecio)}</select></td>
      <td><input class="input cant" type="number" min="0" step="0.01" placeholder="0" value="${ing.cantidad ?? ""}"></td>
      <td><select class="uc">${opcionesUnidad(ing.unidadCant)}</select></td>
      <td class="num celda-coste">${fmt(costeIngrediente(ing))}</td>
      <td><button class="btn-borrar-fila" title="Eliminar ingrediente">✕</button></td>
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
  const total = costeTotal(actual);
  const raciones = Math.max(1, Number(inputRaciones.value) || 1);
  $("#coste-total").textContent = fmt(total);
  $("#coste-racion").textContent = fmt(total / raciones);
}

function ingredienteVacio() {
  return { nombre: "", precio: "", unidadPrecio: "kg", cantidad: "", unidadCant: "g" };
}

function abrirEditor() {
  editor.hidden = false;
  bienvenida.hidden = true;
}

function nuevoPlato() {
  actual = { id: null, nombre: "", raciones: 1, ingredientes: [ingredienteVacio()] };
  inputNombre.value = "";
  inputRaciones.value = 1;
  $("#btn-eliminar").hidden = true;
  $("#aviso-guardado").textContent = "";
  abrirEditor();
  renderIngredientes();
  recalcular();
  renderLista();
  inputNombre.focus();
}

function abrirPlato(id) {
  const p = platos.find((x) => x.id === id);
  if (!p) return;
  // copia de trabajo para no mutar el guardado hasta pulsar "Guardar"
  actual = JSON.parse(JSON.stringify(p));
  if (!actual.ingredientes.length) actual.ingredientes.push(ingredienteVacio());
  inputNombre.value = actual.nombre;
  inputRaciones.value = actual.raciones || 1;
  $("#btn-eliminar").hidden = false;
  $("#aviso-guardado").textContent = "";
  abrirEditor();
  renderIngredientes();
  recalcular();
  renderLista();
}

function guardar() {
  actual.nombre = inputNombre.value.trim() || "(sin nombre)";
  actual.raciones = Math.max(1, Number(inputRaciones.value) || 1);
  if (actual.id) {
    const i = platos.findIndex((p) => p.id === actual.id);
    if (i !== -1) platos[i] = JSON.parse(JSON.stringify(actual));
  } else {
    actual.id = nuevoId();
    platos.unshift(JSON.parse(JSON.stringify(actual)));
    $("#btn-eliminar").hidden = false;
  }
  guardarPlatos(platos);
  renderLista();
  const aviso = $("#aviso-guardado");
  aviso.textContent = "✓ Guardado";
  setTimeout(() => (aviso.textContent = ""), 2000);
}

function eliminar() {
  if (!actual?.id) return;
  if (!confirm(`¿Eliminar el plato "${actual.nombre}"?`)) return;
  platos = platos.filter((p) => p.id !== actual.id);
  guardarPlatos(platos);
  actual = null;
  editor.hidden = true;
  bienvenida.hidden = false;
  renderLista();
}

function escapar(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// --- Eventos -----------------------------------------------------------------
$("#btn-nuevo").addEventListener("click", nuevoPlato);
$("#btn-add-ing").addEventListener("click", () => {
  actual.ingredientes.push(ingredienteVacio());
  renderIngredientes();
  recalcular();
});
$("#btn-guardar").addEventListener("click", guardar);
$("#btn-eliminar").addEventListener("click", eliminar);
inputNombre.addEventListener("input", () => { if (actual) actual.nombre = inputNombre.value; });
inputRaciones.addEventListener("input", recalcular);
inputBuscar.addEventListener("input", renderLista);

// --- Inicio ------------------------------------------------------------------
renderLista();
