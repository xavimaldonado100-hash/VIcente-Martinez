# Club Deportivo Vicente Martínez · Villa Alemana

Sitio web (app móvil) del club. HTML + JavaScript puro, sin instalar nada.

## Dónde editar cada cosa

| Quiero cambiar…                                              | Archivo                |
|--------------------------------------------------------------|------------------------|
| Dirección, correo, precio de cancha, clave inicial, presidente | `config.js`         |
| Divisiones, clubes de la asociación, directiva, logros, noticias, fotos, horarios | `data.js`           |
| Colores de marca (naranja, crema, carbón)                    | `tailwind-config.js`|
| Animaciones / estilos extra                                  | `styles.css`       |
| Estructura de pantallas, modales, textos fijos               | `index.html`           |
| Lógica (pestañas, reservas, tesorería, guardado)             | `app.js`            |

## Ver el sitio en tu computador

Como usa módulos de JavaScript, no abre con doble clic. Desde esta carpeta:

    python3 -m http.server 8000

y abre http://localhost:8000

## Publicarlo gratis con GitHub Pages

1. Sube todo el contenido de esta carpeta a un repositorio.
2. En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**.
3. Elige la rama `main` y la carpeta `/ (root)` → **Save**.
4. En 1–2 minutos queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

## Guardar cambios para todos (importante)

Sin Firebase, lo que edites en modo admin (tablas, reservas, fotos, noticias) se guarda
**solo en el navegador de quien lo edita**. Los demás verán los datos de `data.js`.

Dos formas de manejarlo:

- **Simple:** edita `data.js` y haz commit. Todos ven los cambios al recargar.
- **En vivo:** crea un proyecto en Firebase, activa Firestore y Authentication → Anónimo,
  y pega la config en `firebaseConfig` dentro de `config.js`.

Ojo: la clave de admin (PIN) vive en el código del navegador, así que no es seguridad real.
Si activas Firebase, configura bien las reglas de Firestore y no guardes datos sensibles.
