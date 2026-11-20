// =====================================================================
// DATOS DEL CLUB  ·  Edita este archivo para cambiar divisiones, clubes,
// directiva, logros, noticias, fotos y horarios de cancha.
// =====================================================================

// ==========================================
// CATÁLOGO OFICIAL DE DIVISIONES Y CLUBES
// ==========================================
export const DIVISIONS_LIST = [
    { id: 'primera-adulta', name: 'Primera Adulta', category: 'Serie Adulta' },
    { id: 'segunda-adulta', name: 'Segunda Adulta', category: 'Serie Adulta' },
    { id: 'tercera-adulta', name: 'Tercera Adulta', category: 'Serie Adulta' },
    { id: 'seniors', name: 'Seniors', category: 'Serie Senior' },
    { id: 'super-senior', name: 'Súper Senior', category: 'Serie Senior' },
    { id: 'femenina', name: 'Femenina', category: 'Serie Femenina' },
    { id: 'primera-infantil', name: 'Primera Infantil', category: 'Serie Infantil' },
    { id: 'segunda-infantil', name: 'Segunda Infantil', category: 'Serie Infantil' },
    { id: 'tercera-infantil', name: 'Tercera Infantil', category: 'Serie Infantil' },
    { id: 'cuarta-infantil', name: 'Cuarta Infantil', category: 'Serie Infantil' }
];

export const ASSOCIATION_CLUBS = [
    'Vicente Martínez',
    'Cruz del Sur',
    'El Peumo',
    'Jorge Toro',
    'Manuel Rodríguez',
    'Palmilla',
    'Villa Aurora',
    'Yungay'
];

export function buildInitialStandings() {
    const standings = {};
    DIVISIONS_LIST.forEach((div, idx) => {
        standings[div.id] = ASSOCIATION_CLUBS.map((clubName, cIdx) => {
            const isVM = clubName === 'Vicente Martínez';
            const basePts = isVM ? 22 - (idx % 4) : Math.max(6, 20 - ((cIdx * 2 + idx) % 14));
            const pj = 9;
            const pg = Math.min(pj, Math.floor(basePts / 3));
            const pe = Math.min(pj - pg, basePts % 3);
            const pp = Math.max(0, pj - pg - pe);
            const gf = pg * 2 + pe + (isVM ? 5 : 2);
            const dg = isVM ? 11 - (idx % 3) : (pg - pp) * 2;
            return {
                club: clubName,
                pj,
                pg,
                pe,
                pp,
                gf,
                dg,
                pts: basePts
            };
        });
    });
    return standings;
}

export const DEFAULT_STANDINGS = buildInitialStandings();

export const DIRECTIVA_DATA = [
    { id: 'dir-1', role: 'Vicepresidente', name: 'Carlos Alberto Muñoz Vega', photo: null },
    { id: 'dir-2', role: 'Secretario General', name: 'Patricio Hernán Soto Díaz', photo: null },
    { id: 'dir-3', role: 'Tesorero', name: 'Luis Eduardo Contreras Tapia', photo: null },
    { id: 'dir-4', role: 'Director Deportivo', name: 'Javier Andrés Morales Rojas', photo: null }
];

export const LOGROS_DATA = [
    { id: 'log-1', year: '2025', title: 'Campeón General Asociación Villa Alemana', desc: 'Primer lugar acumulado en series adultas e infantiles.' },
    { id: 'log-2', year: '2024', title: 'Campeón Primera Adulta & Seniors', desc: 'Doble corona obtenida en cancha oficial con invicto de local.' },
    { id: 'log-3', year: '2023', title: 'Copa Aniversario Villa Alemana', desc: 'Reconocimiento a la trayectoria deportiva y formación juvenil.' }
];

export const NOTICIAS_DATA = [
    {
        id: 'not-1',
        tag: 'Citación Oficial',
        date: 'Este Fin de Semana',
        title: 'Fecha Oficial Campeonato Asociación',
        body: 'Se cita a todas las series infantiles, femenina, adultas y seniors 45 minutos antes de su horario programado en cancha Los Eucaliptos 1600.'
    },
    {
        id: 'not-2',
        tag: 'Arriendo de Cancha',
        date: 'Horario Vespertino',
        title: 'Disponibilidad de Cancha para Partidos Amistosos',
        body: 'Ya puedes revisar los bloques disponibles desde las 16:00 a 23:00 hrs en la pestaña Cancha ($20.000 por hora).'
    }
];

export const DEFAULT_CLUB_PHOTOS = [
    {
        id: 'photo-copa',
        tag: 'Campeones en Cancha',
        title: 'Levantando la Copa Vicente Martínez',
        desc: 'Nuestros jugadores celebrando el trofeo con la camiseta oficial.',
        imageUrl: null,
        preset: 'trophy'
    },
    {
        id: 'photo-banderazo',
        tag: 'La Hinchada VM',
        title: 'Banderazo Nocturno de la Familia VM',
        desc: 'Lienzos y banderas alentando al club en Villa Alemana.',
        imageUrl: null,
        preset: 'fans'
    }
];

// Horarios oficiales de cancha: 08:00 am a 20:00 pm
export const FIELD_HOURS = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
    '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];
