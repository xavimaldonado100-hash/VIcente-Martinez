// =====================================================================
// CONFIGURACIÓN GENERAL  ·  Textos, contacto, precios y Firebase
// =====================================================================
export const CONFIG = {
  clubName: 'Club Deportivo Vicente Martínez',
  city: 'Villa Alemana · Valparaíso',

  // Dirección y contacto
  addressShort: 'Los Eucaliptos 1600, Villa Alemana',
  addressFull: 'Los Eucaliptos 1600, Villa Alemana, Valparaíso',
  addressRegion: 'Los Eucaliptos 1600, Villa Alemana, Región de Valparaíso.',
  email: 'xavi.maldonado100@gmail.com',

  // Cancha
  fieldPrice: 20000,            // valor por hora (CLP)
  fieldPriceLabel: '$20.000',   // cómo se muestra en pantalla
  fieldHours: '08:00 a 20:00 hrs',

  // Clave de administrador inicial (se puede cambiar desde la app).
  // OJO: es una clave del lado del cliente, no es seguridad real.
  defaultAdminPin: '2026',

  // Responsable inicial (se puede editar desde la app en modo admin)
  presidentName: 'Rodrigo Fernando Maldonado Pradenas',
  presidentRole: 'Presidente',

  // Clave del respaldo local (cámbiala si quieres "resetear" lo guardado en los navegadores)
  localBackupKey: 'vm_club_state_backup_v1',

  // -------------------------------------------------------------------
  // FIREBASE (opcional, para que los cambios se vean en TODOS los celulares)
  // Sin esto, lo que edites solo se guarda en TU navegador.
  // Pega aquí la config de tu proyecto Firebase (Configuración > Tus apps > Web).
  // Ver README.md, sección "Guardar cambios para todos".
  // -------------------------------------------------------------------
  firebaseConfig: null
  /* Ejemplo:
  firebaseConfig: {
    apiKey: '...',
    authDomain: '...firebaseapp.com',
    projectId: '...',
    storageBucket: '...',
    messagingSenderId: '...',
    appId: '...'
  }
  */
};
