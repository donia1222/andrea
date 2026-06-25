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
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// --- Estado en memoria -------------------------------------------------------
let platos = cargarPlatos();
let actual = null; // plato que se está creando/editando (copia de trabajo)

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

// --- Historial (lista de platos guardados) -----------------------------------
function renderLista() {
  const filtro = inputBuscar.value.trim().toLowerCase();
  lista.innerHTML = "";
  const sinPlatos = platos.length === 0;
  $("#historial-vacio").hidden = !sinPlatos;
  inputBuscar.hidden = sinPlatos;

  const visibles = platos.filter((p) => p.nombre.toLowerCase().includes(filtro));
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
      <button class="btn-borrar-plato" title="Eliminar plato"><svg class="ic ic-sm"><use href="#i-trash"/></svg></button>`;
    li.querySelector(".nombre").textContent = p.nombre || "(sin nombre)";
    li.addEventListener("click", () => abrirPlato(p.id));
    li.querySelector(".btn-borrar-plato").addEventListener("click", (e) => {
      e.stopPropagation();
      eliminarPlato(p.id);
    });
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
  actual = null;           // limpia el panel
  renderLista();
  mostrarVista("historial"); // pasa al historial
}

// "No guardar": descarta los cambios y vuelve al historial.
function cancelar() {
  actual = null;
  renderLista();
  mostrarVista("historial");
}

// Eliminar desde el editor (el plato que se está editando).
function eliminar() {
  if (actual?.id) eliminarPlato(actual.id, true);
}

// Eliminar un plato por id (desde la lista o el editor).
function eliminarPlato(id, volverAlHistorial = false) {
  const p = platos.find((x) => x.id === id);
  if (!p) return;
  if (!confirm(`¿Eliminar el plato "${p.nombre}"?`)) return;
  platos = platos.filter((x) => x.id !== id);
  guardarPlatos(platos);
  if (volverAlHistorial || (actual && actual.id === id)) {
    actual = null;
    mostrarVista("historial");
  }
  renderLista();
}

function escapar(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// --- Eventos -----------------------------------------------------------------
$("#tab-crear").addEventListener("click", nuevoPlato);
$("#tab-historial").addEventListener("click", () => {
  renderLista();
  mostrarVista("historial");
});
$("#btn-vacio-crear").addEventListener("click", nuevoPlato);
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
// Si ya hay platos guardados, abrimos el Historial; si no, el formulario de Crear.
renderLista();
if (platos.length > 0) {
  mostrarVista("historial");
} else {
  nuevoPlato();
}
