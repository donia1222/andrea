# 🍽️ Coste de Menús

App sencilla para calcular el coste de los platos de un restaurante sumando el
precio de sus ingredientes, con conversión automática de unidades (g, kg, ml, L, ud).
Los datos se guardan en el **navegador** (localStorage), así que puedes cerrar y
volver a editar tus platos cuando quieras.

## Cómo se calcula

Para cada ingrediente indicas:

- **Precio de compra** y **a cuánto corresponde** (ej.: `15 CHF` por `kg`).
- **Cantidad usada** en el plato y su unidad (ej.: `200 g`).

La app convierte las unidades (siempre dentro de la misma familia: peso, volumen
o unidades) y calcula el coste:

```
200 g de pollo  →  0,2 kg × 15 CHF/kg = 3,00 CHF
```

El **coste total** del plato es la suma de todos los ingredientes. También se
muestra el **coste por ración** si indicas cuántas raciones salen.

## Uso

Requiere Node.js (18 o superior). No hay dependencias que instalar.

```bash
cd coste-menus
npm start
```

Luego abre **http://localhost:3000** en el navegador.

> También puedes abrir directamente `public/index.html` en el navegador sin
> usar Node; el servidor sólo sirve para tenerlo en una URL local.

## Estructura

```
coste-menus/
├── package.json
├── server.js          # servidor estático mínimo (sin dependencias)
├── README.md
└── public/
    ├── index.html
    ├── styles.css
    └── app.js         # toda la lógica + guardado en localStorage
```

## Datos

Todo se guarda bajo la clave `coste-menus:v1` en el localStorage del navegador.
Si borras los datos del navegador o usas otro equipo, no verás los platos
guardados anteriormente.
# andrea
