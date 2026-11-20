// Colores y tipografía de marca. Cambia aquí los colores del club y se actualiza todo el sitio.
tailwind.config = {
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      colors: {
        clubOrange: '#EC6625',      // color principal
        clubOrangeDark: '#D35315',  // hover / variante oscura
        clubCream: '#F5F2EE',       // fondo
        clubCarbon: '#111111'       // texto oscuro
      }
    }
  }
};
