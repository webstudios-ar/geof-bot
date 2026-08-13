require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

process.on('unhandledRejection', (err) => console.error('[GLOBAL] Unhandled promise rejection:', err));
process.on('uncaughtException', (err) => console.error('[GLOBAL] Uncaught exception:', err));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

// ==================== SUPABASE ====================
const { createClient } = require('@supabase/supabase-js');
let db = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  try {
    db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'X-Client-Info': 'geof-bot' } }
    });
    console.log('[SUPABASE] Conectado.');
  } catch (e) {
    console.error('[SUPABASE] No se pudo inicializar:', e.message);
  }
} else {
  console.warn('[SUPABASE] SUPABASE_URL o SUPABASE_KEY no definidas.');
}

// ==================== CONFIGURACIÓN ====================
const GITHUB_REPO       = 'webstudios-ar/geof-bot';

const CANAL_PANEL       = '1523832372062326944';
const CANAL_APROBACION  = '1523833135656210462'; // ACTUALIZADO — canal correcto donde llegan los expedientes
const CANAL_UPDATES     = '1493838384416952392';
const CANAL_OPERATIVOS  = '1460758338387050550';

const FORO_MAFIAS       = '1384747758497304747';
const FORO_PERSONAS     = '1526692575992348692';

// ==================== JERARQUÍA G.E.O.F ====================
const ROL_DUENO_GEOF      = '1474513244084371697';
const ROL_DIRECTOR_GEOF   = '1459343404155670710';
const ROL_COMANDANTE_GEOF = '1384748336447361085';
const ROL_JEFE_GEOF       = '1457168018269278402';
const ROL_SUBJEFE_GEOF    = '1412987223086731336';
const ROL_NEGOCIADOR      = '1384748836978823300';
const ROL_FRANCOTIRADOR   = '1384748893362983005';
const ROL_TACTICO         = '1412986446599557170';
const ROL_GEOF            = '1384737385551495178';
const ROL_MIEMBRO_GEOF    = '1474252638832033884'; // rol que se asigna al aprobar por botón

const ROL_JEFE_INTEL      = 'PENDIENTE';
const ROL_INFILTRADO      = 'PENDIENTE';
const ROL_ANALISTA        = 'PENDIENTE';
const ROL_INTERROGADOR    = 'PENDIENTE';

// ==================== GRUPOS DE PERMISOS ====================
const ALTO_MANDO = [ROL_DUENO_GEOF, ROL_DIRECTOR_GEOF, ROL_COMANDANTE_GEOF];
const JEFATURA = [...ALTO_MANDO, ROL_JEFE_GEOF, ROL_SUBJEFE_GEOF];
const MANDO_OPERATIVO = [...JEFATURA, ROL_NEGOCIADOR, ROL_FRANCOTIRADOR, ROL_TACTICO];
const RAMA_INTEL = [...JEFATURA, ROL_JEFE_INTEL, ROL_ANALISTA, ROL_INTERROGADOR, ROL_INFILTRADO]
  .filter(r => /^\d{17,20}$/.test(r));
const ROLES_AUTORIZADOS = JEFATURA;

const TODOS_ROLES_GEOF = [
  ROL_DUENO_GEOF, ROL_DIRECTOR_GEOF, ROL_COMANDANTE_GEOF,
  ROL_JEFE_GEOF, ROL_SUBJEFE_GEOF, ROL_NEGOCIADOR,
  ROL_FRANCOTIRADOR, ROL_TACTICO, ROL_GEOF
];

const tienePermiso = (member, grupo) => grupo.some(r => member.roles.cache.has(r));

const TIEMPO_MAX_POSTULACION_MS = 15 * 60 * 1000;
const COOLDOWN_POSTULACION_MS   = 24 * 60 * 60 * 1000;

// ==================== PALETA VISUAL ====================
const COLOR = {
  BASE:        0x2C2F33,
  PENDIENTE:   0xE67E22,
  APROBADO:    0xD4AC0D,
  RECHAZADO:   0xC0392B,
  EXPULSION:   0x1C1C1C,
  RETIRO:      0x5D6D7E,
  OPERATIVO:   0xE74C3C,
  EXITO:       0x27AE60,
  ADVERTENCIA: 0xF39C12,
  INFO:        0x3498DB
};

const DIV = '━━━━━━━━━━━━━━━━━━━━━━━';
const SEP = '▸';

// ==================== PROCEDIMIENTOS DE INTERPRETACIÓN ====================
// Para agregar un procedimiento nuevo: copiá un bloque completo, cambialo y listo.
//   valor        -> identificador interno, sin espacios ni acentos (máx. 100 caracteres)
//   nombre       -> lo que se ve en la lista del comando (máx. 100 caracteres)
//   resumen      -> bajada del embed
//   aclaraciones -> array de líneas informativas (opcional, puede ir vacío: [])
//   lineas       -> el bloque copiable, EXACTAMENTE como se pega en el juego
// Límite de Discord: máximo 25 procedimientos en la lista.
const PROCEDIMIENTOS = [
  {
    valor: 'detector-mentiras',
    nombre: 'Detector de mentiras',
    resumen: 'Procedimiento completo de utilización del detector de mentiras durante un interrogatorio.',
    aclaraciones: [
      'El interrogatorio cuenta con dos líneas de resultado, verdadera y falsa. Se envía únicamente la que corresponda en cada caso.',
      'Las líneas del interrogatorio se repiten tantas veces como preguntas se formulen.',
      'El orden de las líneas no debe alterarse.'
    ],
    lineas: [
      '/e box',
      '/me deja la máquina sobre la mesa',
      '/me enciende el detector de mentiras y prepara los sensores',
      '/do El detector de mentiras estaría conectado a un monitor portátil.',
      '/e tablet',
      '/me coloca los sensores en los dedos y el brazo del sujeto',
      '/do El sospechoso sentiría una ligera presión en el brazo por el brazalete.',
      '/do El detector emitiría una luz verde si dice la verdad, o roja si miente.',
      '/do ¿Sería verdad?',
      '/do La luz del detector se enciende en verde tras la respuesta.',
      '/do La luz del detector se enciende en rojo tras la respuesta.',
      '/me apaga el detector y retira los sensores del sospechoso',
      '/do El sospechoso quedaría libre de los sensores, sin daños.',
      '/me guarda el informe con los resultados obtenidos',
      '/me guarda el detector de mentiras en la caja',
      '/e box'
    ]
  },
  {
    valor: 'bateria',
    nombre: 'Batería',
    resumen: 'Procedimiento de utilización de la batería como método de coacción durante un interrogatorio.',
    aclaraciones: [
      'Su utilización requiere acuerdo previo con el jugador interviniente y se ajusta en todo momento a la normativa del servidor.',
      'El procedimiento se interrumpe de inmediato ante cualquier indicación por vía OOC.',
      'Las líneas de aumento de intensidad pueden omitirse según el desarrollo de la escena.',
      'El orden de las líneas no debe alterarse.'
    ],
    lineas: [
      '/me coloca la batería sobre la mesa y conecta dos cables con pinzas',
      '/do La batería estaría cargada y lista para emitir descargas.',
      '/me toma las pinzas y las acerca al sospechoso, amenazándolo',
      '/do El sospechoso vería salir las chispas al juntar los cables.',
      '/me coloca una de las pinzas en el brazo del sospechoso',
      '/do El sospechoso sentiría el metal frío en la piel.',
      '/me coloca la segunda pinza en el otro brazo y enciende el paso de la corriente',
      '/do El sospechoso recibiría una descarga eléctrica que le provocaría dolor intenso y contracciones musculares.',
      '/me aumenta la intensidad de la corriente, manteniendo la presión sobre los cables',
      '/do El cuerpo del sospechoso se sacudiría violentamente por la descarga.',
      '/me retira las pinzas del sospechoso y desconecta la batería',
      '/do El sospechoso quedaría exhausto, con marcas leves de quemaduras y dolor muscular.'
    ]
  },
  {
    valor: 'cuchillo',
    nombre: 'Cuchillo',
    resumen: 'Procedimiento de utilización del cuchillo como método de coacción durante un interrogatorio.',
    aclaraciones: [
      'Su utilización requiere acuerdo previo con el jugador interviniente y se ajusta en todo momento a la normativa del servidor.',
      'El procedimiento se interrumpe de inmediato ante cualquier indicación por vía OOC.',
      'El orden de las líneas no debe alterarse.'
    ],
    lineas: [
      '/me saca un cuchillo y lo acerca lentamente al sospechoso',
      '/do El filo del cuchillo brillaría con la luz del lugar.',
      '/me apoya la punta del cuchillo en el brazo del sospechoso y presiona levemente',
      '/do El sospechoso sentiría un dolor punzante y vería un leve corte en su piel.',
      '/me le muestra el cuchillo ensangrentado'
    ]
  },
  {
    valor: 'hacha',
    nombre: 'Hacha',
    resumen: 'Procedimiento de utilización del hacha como método de coacción durante un interrogatorio.',
    aclaraciones: [
      'Su utilización requiere acuerdo previo con el jugador interviniente y se ajusta en todo momento a la normativa del servidor.',
      'El procedimiento se interrumpe de inmediato ante cualquier indicación por vía OOC.',
      'Finalizada la animación de impacto, se retoma la animación de sostén mediante /e axe.',
      'El orden de las líneas no debe alterarse.'
    ],
    lineas: [
      '/e axe',
      '/me toma el hacha y la apoya contra el suelo, dejándola a la vista del sospechoso',
      '/do Se vería el filo del hacha.',
      '/me se acerca lentamente al sospechoso, levantando el hacha con ambas manos',
      '/me acerca el filo del hacha al cuello del sospechoso, sin tocarlo',
      '/do El sospechoso sentiría el frío del metal muy cerca de su piel.',
      '/me golpea la mesa con el mango del hacha para intimidar',
      '/do El sonido seco del golpe aumentaría la tensión en la sala.',
      '/me desliza el filo del hacha por el brazo del sospechoso, apenas cortando la piel',
      '/do El sospechoso sentiría un corte superficial y dolor punzante.',
      '/me apoya el filo en la pierna del sospechoso y ejerce presión',
      '/do El sospechoso sentiría una mezcla de miedo y dolor por la presión del hacha.',
      '/me levanta el hacha y la deja caer cerca del pie del sospechoso',
      '/e axe2',
      '/e axe',
      '/do El filo impactaría contra el suelo, a pocos centímetros de su pie.',
      '/me limpia el filo del hacha y la guarda',
      '/do El sospechoso quedaría con heridas leves y un fuerte estado de conmoción.'
    ]
  },
  {
    valor: 'cinta',
    nombre: 'Cinta',
    resumen: 'Procedimiento de utilización de la cinta para impedir la comunicación del sospechoso durante un interrogatorio.',
    aclaraciones: [
      'Su utilización requiere acuerdo previo con el jugador interviniente y se ajusta en todo momento a la normativa del servidor.',
      'El procedimiento se interrumpe de inmediato ante cualquier indicación por vía OOC.',
      'Los intentos de habla del sospechoso son interpretados por el propio jugador y no forman parte de este bloque.',
      'El orden de las líneas no debe alterarse.'
    ],
    lineas: [
      '/me toma un trozo de cinta y lo coloca firmemente sobre la boca del sospechoso',
      '/do El sospechoso tendría la boca cubierta, lo que le dificultaría hablar.',
      '/do Solo se escucharían murmullos apagados e incomprensibles.',
      '/me arranca la cinta de la boca del sospechoso de un tirón',
      '/do El sospechoso sentiría dolor en la piel y podría volver a hablar.'
    ]
  }
];

// Minutos hasta que el hilo se archiva solo y deja de ocupar lugar en la lista de canales.
// Valores admitidos por Discord: 60 (1 hora), 1440 (1 día), 4320 (3 días), 10080 (7 días).
const ARCHIVO_HILO = 60;

// Aviso fijo que se agrega al embed de todos los procedimientos.
const NOTA_ORIENTATIVA =
  'El presente procedimiento constituye una forma posible de interpretar la situación y no una fórmula obligatoria. ' +
  'Cada efectivo se encuentra habilitado a desarrollar sus propias acciones sobre la marcha, siempre que resulten coherentes con la escena y con el contexto del procedimiento.\n' +
  'Quienes no cuenten con experiencia en la utilización de /me y /do, o encuentren dificultad para desarrollarlos, deben seguir este procedimiento al pie de la letra: constituye la forma correcta de ejecutarlo.';

// Parte el bloque copiable en trozos que respeten el límite de 2000 caracteres de Discord.
const trozosProcedimiento = (lineas) => {
  const trozos = [];
  let actual = [];
  let largo = 0;
  for (const linea of lineas) {
    if (largo + linea.length + 1 > 1900 && actual.length > 0) {
      trozos.push(actual);
      actual = [];
      largo = 0;
    }
    actual.push(linea);
    largo += linea.length + 1;
  }
  if (actual.length > 0) trozos.push(actual);
  return trozos;
};

// ==================== ESTADO ====================
const asistentes = {};
const postulacionesActivas = {};
let postulacionesCooldown = {};
let votaciones = {};
let expedienteCounter = 0;
let botListo = false;

const fechaCorta = () => new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const generarExpediente = () => {
  expedienteCounter = (expedienteCounter + 1) % 10000;
  const num = String(expedienteCounter).padStart(4, '0');
  const year = new Date().getFullYear();
  return `PST-${num}-${year}`;
};

// ==================== PERSISTENCIA ====================
async function guardarJson(archivo, data, mensaje) {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${archivo}`, {
      headers: { 'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN, 'Accept': 'application/vnd.github+json' }
    });
    const sha = res.status !== 404 ? (await res.json()).sha : null;
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const body = { message: mensaje || `update ${archivo}`, content };
    if (sha) body.sha = sha;
    await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${archivo}`, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) { console.error(`Error guardando ${archivo}:`, err.message); }
}

async function cargarJson(archivo) {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${archivo}`, {
      headers: { 'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN, 'Accept': 'application/vnd.github+json' }
    });
    if (res.status === 404) return null;
    const data = await res.json();
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  } catch (err) { console.error(`Error cargando ${archivo}:`, err.message); return null; }
}

const guardarAsistentes = () => guardarJson('asistentes.json', asistentes, 'update asistentes');
const guardarCooldowns = () => guardarJson('postulaciones_cooldown.json', postulacionesCooldown, 'update cooldowns');
const guardarVotaciones = () => guardarJson('votaciones.json', votaciones, 'update votaciones');

async function guardarPostulacionesActivas() {
  const serializable = {};
  for (const [uid, data] of Object.entries(postulacionesActivas)) {
    serializable[uid] = { inicio: data.inicio, expiraTs: data.expiraTs, expediente: data.expediente, datos: data.datos };
  }
  await guardarJson('postulaciones_activas.json', serializable, 'update postulaciones activas');
}

function estaEnCooldown(userId) {
  // El Dueño NUNCA tiene cooldown
  const c = postulacionesCooldown[userId];
  if (!c) return null;
  if (Date.now() >= c) {
    delete postulacionesCooldown[userId];
    guardarCooldowns().catch(() => {});
    return null;
  }
  return c;
}

function iniciarTimeoutPostulacion(userId) {
  const p = postulacionesActivas[userId];
  if (!p) return;
  if (p.timeoutId) clearTimeout(p.timeoutId);
  const restanteMs = Math.max(0, p.expiraTs - Date.now());
  p.timeoutId = setTimeout(async () => {
    if (!postulacionesActivas[userId]) return;
    const exp = postulacionesActivas[userId].expediente;
    delete postulacionesActivas[userId];
    guardarPostulacionesActivas().catch(e => console.error('Save error:', e.message));
    // Si el examen se cayó por timeout, NO aplicar cooldown — pueden reintentar ya
    // (el cooldown de 24h solo se aplica cuando un evaluador rechaza manualmente)
    try {
      const guild = client.guilds.cache.first();
      if (guild) {
        const m = await guild.members.fetch(userId).catch(() => null);
        if (m) {
          const embed = new EmbedBuilder()
            .setAuthor({ name: 'G.E.O.F • Sistema de Postulaciones' })
            .setTitle('⏱️ Tiempo agotado')
            .setDescription(`Tu expediente **\`${exp}\`** fue cerrado por vencimiento de tiempo.\n\nTenías **15 minutos** para completar el examen.\n\n✅ **Podés volver a postularte cuando quieras** — no se aplicó cooldown por error técnico.`)
            .setColor(COLOR.ADVERTENCIA)
            .setFooter({ text: 'G.E.O.F • Kilombo RP' })
            .setTimestamp();
          await m.send({ embeds: [embed] }).catch(() => {});
        }
      }
    } catch (e) { /* ignorar */ }
  }, restanteMs);
}

async function cargarPostulacionesActivas() {
  const loaded = await cargarJson('postulaciones_activas.json');
  if (!loaded) return;
  const ahora = Date.now();
  for (const [uid, p] of Object.entries(loaded)) {
    if (p.expiraTs > ahora) {
      postulacionesActivas[uid] = {
        inicio: p.inicio,
        expiraTs: p.expiraTs,
        expediente: p.expediente || generarExpediente(),
        timeoutId: null,
        datos: p.datos || {}
      };
      iniciarTimeoutPostulacion(uid);
    }
  }
  console.log('Postulaciones activas restauradas:', Object.keys(postulacionesActivas).length);
}

// ==================== HELPERS DE EMBED ====================
const trunc = (s, max = 400) => {
  const t = (s || '_—_').toString();
  return t.length > max ? t.slice(0, max - 3) + '...' : t;
};
const embedBase = (color = COLOR.BASE) => new EmbedBuilder().setColor(color).setFooter({ text: 'G.E.O.F • Grupo Especial de Operaciones Federales' });

function construirEmbedVotacion(v) {
  const siList = Object.entries(v.votos).filter(([, val]) => val === 'si').map(([u]) => `${SEP} <@${u}>`);
  const noList = Object.entries(v.votos).filter(([, val]) => val === 'no').map(([u]) => `${SEP} <@${u}>`);
  const total = siList.length + noList.length;

  const embed = new EmbedBuilder()
    .setAuthor({ name: 'G.E.O.F • Operaciones Tácticas' })
    .setTitle(`🚨 OPERATIVO — ${(v.titulo || '').toUpperCase()}`)
    .setColor(v.cerrada ? COLOR.BASE : COLOR.OPERATIVO)
    .setTimestamp()
    .setFooter({ text: v.cerrada ? 'G.E.O.F • Convocatoria cerrada' : 'G.E.O.F • El voto es definitivo' });

  let desc = `Convocado por <@${v.autor}>\n${DIV}\n`;
  if (v.cerrada) {
    desc += '🔒 **Esta convocatoria fue cerrada.**';
  } else {
    desc += `⚠️ **El voto es definitivo.** Una vez emitido no se puede cambiar ni retirar.\n` +
            `⚠️ **Votar ASISTO y no presentarse se computa como falta al G.E.O.F.**`;
  }
  embed.setDescription(desc);

  const campos = [];
  if (v.hora)  campos.push({ name: '🕐 Hora', value: '```' + v.hora + '```', inline: true });
  if (v.lugar) campos.push({ name: '📍 Zona', value: '```' + v.lugar + '```', inline: true });
  if (v.requisitos) campos.push({ name: '👥 Participantes', value: '```' + v.requisitos + '```', inline: true });
  if (v.descripcion) campos.push({ name: '📝 Objetivo', value: `> ${trunc(v.descripcion, 800)}`, inline: false });
  if (v.detalle && v.detalle.trim()) campos.push({ name: '📋 Detalle', value: `> ${trunc(v.detalle, 800)}`, inline: false });

  campos.push(
    { name: `${DIV}\n✅ ASISTEN (${siList.length})`, value: siList.length ? siList.join('\n') : '_Nadie todavía_', inline: true },
    { name: '\u200B', value: '\u200B', inline: true },
    { name: `❌ NO ASISTEN (${noList.length})`, value: noList.length ? noList.join('\n') : '_Nadie todavía_', inline: true },
    { name: '\u200B', value: `${DIV}\n👥 **Total de votos:** ${total}`, inline: false }
  );

  embed.addFields(...campos);
  return embed;
}

function filaBotonesVotacion(msgId, cerrada) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('VOTO_SI_' + msgId).setLabel('ASISTO').setStyle(ButtonStyle.Success).setEmoji('✅').setDisabled(cerrada),
    new ButtonBuilder().setCustomId('VOTO_NO_' + msgId).setLabel('NO ASISTO').setStyle(ButtonStyle.Danger).setEmoji('❌').setDisabled(cerrada),
    new ButtonBuilder().setCustomId('VOTO_CERRAR_' + msgId).setLabel(cerrada ? 'CERRADA' : 'CERRAR VOTACIÓN').setStyle(ButtonStyle.Secondary).setEmoji('🔒').setDisabled(cerrada)
  );
}

// ==================== LEGAJOS — HELPERS ====================
const EST_MAFIA = {
  activa:        { label: 'ACTIVA',         emoji: '🟢', color: COLOR.OPERATIVO },
  observacion:   { label: 'EN OBSERVACIÓN', emoji: '🟡', color: COLOR.ADVERTENCIA },
  desarticulada: { label: 'DESARTICULADA',  emoji: '⚫', color: COLOR.BASE }
};
const EST_PERSONA = {
  libre:    { label: 'LIBRE',    emoji: '🟢', color: COLOR.OPERATIVO },
  detenido: { label: 'DETENIDO', emoji: '🔵', color: COLOR.INFO },
  profugo:  { label: 'PRÓFUGO',  emoji: '🔴', color: COLOR.RECHAZADO },
  muerto:   { label: 'MUERTO',   emoji: '⚫', color: COLOR.EXPULSION }
};

async function nuevoExpediente(prefijo) {
  const { data, error } = await db.rpc('nuevo_expediente', { prefijo });
  if (error) throw new Error(`No se pudo generar expediente: ${error.message}`);
  return data;
}

function embedMafia(m, integrantes = []) {
  const est = EST_MAFIA[m.estado] || EST_MAFIA.activa;
  const embed = new EmbedBuilder()
    .setAuthor({ name: 'G.E.O.F • Inteligencia' })
    .setTitle(`🗂️ ${m.nombre.toUpperCase()}`)
    .setColor(est.color)
    .setDescription(
      `**Expediente** \`${m.expediente}\`\n` +
      `**Estado** ${est.emoji} **${est.label}**\n${DIV}`
    );

  let sede = '';
  if (m.cp !== null && m.cp !== undefined) sede += `C.P. ${m.cp}`;
  if (m.sede_nota) sede += (sede ? ' — ' : '') + m.sede_nota;

  const campos = [];
  if (sede)         campos.push({ name: '📍 Sede', value: '```' + trunc(sede, 100) + '```', inline: false });
  if (m.lider)      campos.push({ name: '👑 Líder(es)', value: '```' + trunc(m.lider, 100) + '```', inline: true });
  if (m.frecuencia) campos.push({ name: '📻 Frecuencia', value: '```' + trunc(m.frecuencia, 60) + '```', inline: true });
  if ((m.lider ? 1 : 0) + (m.frecuencia ? 1 : 0) === 1) campos.push({ name: '\u200B', value: '\u200B', inline: true });
  if (m.actividad)  campos.push({ name: '🎯 Actividad', value: '```' + trunc(m.actividad, 80) + '```', inline: true });
  if (m.armamento)  campos.push({ name: '🔫 Armamento', value: '```' + trunc(m.armamento, 100) + '```', inline: true });
  if ((m.actividad ? 1 : 0) + (m.armamento ? 1 : 0) === 1) campos.push({ name: '\u200B', value: '\u200B', inline: true });

  const lista = integrantes.length
    ? integrantes.map(p => {
        const e = EST_PERSONA[p.estado] || EST_PERSONA.libre;
        const alias = p.alias ? ` "${p.alias}"` : '';
        const rango = p.rango ? ` · ${p.rango}` : '';
        return `${SEP} ${e.emoji} \`${p.expediente}\` **${p.nombre}**${alias}${rango}`;
      }).join('\n')
    : '_Sin integrantes registrados._';
  campos.push({ name: `${DIV}\n👥 Integrantes vinculados (${integrantes.length})`, value: trunc(lista, 1000), inline: false });

  if (m.notas) campos.push({ name: '📝 Notas', value: `> ${trunc(m.notas, 900)}`, inline: false });

  embed.addFields(...campos);
  if (m.foto && /^https?:\/\//.test(m.foto)) embed.setImage(m.foto);
  embed.setFooter({ text: 'Actualizado por última vez' }).setTimestamp(new Date(m.actualizado_en));
  return embed;
}

function embedPersona(p, org = null) {
  const est = EST_PERSONA[p.estado] || EST_PERSONA.libre;
  const embed = new EmbedBuilder()
    .setAuthor({ name: 'G.E.O.F • Inteligencia' })
    .setTitle(`👤 ${p.nombre.toUpperCase()}${p.alias ? ` — "${p.alias}"` : ''}`)
    .setColor(est.color)
    .setDescription(
      `**Expediente** \`${p.expediente}\`\n` +
      `**Estado** ${est.emoji} **${est.label}**\n${DIV}`
    );

  const campos = [];
  campos.push({ name: '🏴 Organización', value: org ? `\`${org.expediente}\`\n**${org.nombre}**` : '```Sin vínculo```', inline: true });
  if (p.rango) campos.push({ name: '🎖️ Rango', value: '```' + trunc(p.rango, 60) + '```', inline: true });
  if (campos.length === 1) campos.push({ name: '\u200B', value: '\u200B', inline: true });

  if (p.notas) campos.push({ name: `${DIV}\n📝 Notas`, value: `> ${trunc(p.notas, 900)}`, inline: false });

  embed.addFields(...campos)
    .setFooter({ text: `Actualizado por última vez` })
    .setTimestamp(new Date(p.actualizado_en));
  return embed;
}

async function sincronizarPost(foroId, registro, embed, tabla) {
  const foro = await client.channels.fetch(foroId);
  if (registro.thread_id) {
    try {
      const hilo = await client.channels.fetch(registro.thread_id);
      const inicial = await hilo.fetchStarterMessage();
      await inicial.edit({ embeds: [embed] });
      if (hilo.name !== registro.nombre) await hilo.setName(trunc(registro.nombre, 90)).catch(() => {});
      return hilo.id;
    } catch (e) {
      console.warn(`[LEGAJOS] Post ${registro.thread_id} inaccesible (${e.message}). Se recrea.`);
    }
  }
  const hilo = await foro.threads.create({
    name: trunc(registro.nombre, 90),
    message: { embeds: [embed] },
    reason: `Legajo ${registro.expediente}`
  });
  await db.from(tabla).update({ thread_id: hilo.id }).eq('id', registro.id);
  return hilo.id;
}

async function buscarRegistro(tabla, termino) {
  const t = termino.trim();
  const porExp = await db.from(tabla).select('*').eq('expediente', t.toUpperCase()).maybeSingle();
  if (porExp.data) return porExp.data;
  const porNombre = await db.from(tabla).select('*').ilike('nombre', `%${t}%`).limit(2);
  if (porNombre.error) throw new Error(porNombre.error.message);
  if (!porNombre.data?.length) return null;
  if (porNombre.data.length > 1) {
    const err = new Error('AMBIGUO');
    err.opciones = porNombre.data;
    throw err;
  }
  return porNombre.data[0];
}

// ==================== READY ====================
client.once('ready', async () => {
  console.log('Bot conectado: ' + client.user.tag);
  const asist = await cargarJson('asistentes.json');
  if (asist) Object.assign(asistentes, asist);
  const cool = await cargarJson('postulaciones_cooldown.json');
  if (cool) postulacionesCooldown = cool;
  const vot = await cargarJson('votaciones.json');
  if (vot) votaciones = vot;
  await cargarPostulacionesActivas();
  botListo = true;
  console.log('[BOT] Todos los datos cargados. Bot listo.');

  const geofCmd = new SlashCommandBuilder()
    .setName('geof')
    .setDescription('Comandos del Grupo G.E.O.F')
    .addSubcommand(s => s.setName('nuevo').setDescription('[HEAD] Ingresa un nuevo miembro al G.E.O.F')
      .addUserOption(o => o.setName('usuario').setDescription('El usuario a ingresar').setRequired(true)))
    .addSubcommand(s => s.setName('operativo').setDescription('[HEAD] Anuncia un operativo del G.E.O.F'))
    .addSubcommand(s => s.setName('expulsar').setDescription('[HEAD] Expulsa a un miembro del G.E.O.F')
      .addUserOption(o => o.setName('usuario').setDescription('El usuario a expulsar').setRequired(true))
      .addStringOption(o => o.setName('motivo').setDescription('Motivo de la expulsión').setRequired(true)))
    .addSubcommand(s => s.setName('retiro').setDescription('[HEAD] Registra el retiro voluntario de un miembro del G.E.O.F')
      .addUserOption(o => o.setName('usuario').setDescription('El usuario que se retira').setRequired(true))
      .addStringOption(o => o.setName('motivo').setDescription('Motivo del retiro (opcional)').setRequired(false)))
    .addSubcommand(s => s.setName('panel-postulaciones').setDescription('[HEAD] Publica el panel de convocatoria'));

  const normativasCmd = new SlashCommandBuilder()
    .setName('normativas')
    .setDescription('[HEAD] Publica la normativa general del G.E.O.F');

  const jerarquiaCmd = new SlashCommandBuilder()
    .setName('jerarquia')
    .setDescription('[HEAD] Publica la jerarquía y áreas del G.E.O.F');

  const mafiaCmd = new SlashCommandBuilder()
    .setName('mafia')
    .setDescription('Legajos de organizaciones criminales')
    .addSubcommand(s => s.setName('crear').setDescription('[INTEL] Abre el legajo de una organización')
      .addStringOption(o => o.setName('nombre').setDescription('Nombre de la organización').setRequired(true).setMaxLength(80))
      .addIntegerOption(o => o.setName('cp').setDescription('Código postal de la sede').setMinValue(0).setMaxValue(9999))
      .addStringOption(o => o.setName('sede_nota').setDescription('Detalle de la sede').setMaxLength(200))
      .addStringOption(o => o.setName('lider').setDescription('Líder o líderes').setMaxLength(200))
      .addStringOption(o => o.setName('frecuencia').setDescription('Frecuencia de radio').setMaxLength(60))
      .addStringOption(o => o.setName('actividad').setDescription('Actividad principal').setMaxLength(80))
      .addStringOption(o => o.setName('armamento').setDescription('Armamento frecuente').setMaxLength(200))
      .addStringOption(o => o.setName('foto').setDescription('Link a foto de vestimenta').setMaxLength(300))
      .addStringOption(o => o.setName('estado').setDescription('Estado del caso')
        .addChoices({ name: '🟢 Activa', value: 'activa' }, { name: '🟡 En observación', value: 'observacion' }, { name: '⚫ Desarticulada', value: 'desarticulada' }))
      .addStringOption(o => o.setName('notas').setDescription('Observaciones iniciales').setMaxLength(900)))
    .addSubcommand(s => s.setName('info').setDescription('[INTEL] Consulta un legajo')
      .addStringOption(o => o.setName('buscar').setDescription('Elegí de la lista o escribí para filtrar').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('actualizar').setDescription('[INTEL] Actualiza un legajo existente')
      .addStringOption(o => o.setName('buscar').setDescription('Elegí de la lista o escribí para filtrar').setRequired(true).setAutocomplete(true))
      .addIntegerOption(o => o.setName('cp').setDescription('Nuevo código postal').setMinValue(0).setMaxValue(9999))
      .addStringOption(o => o.setName('sede_nota').setDescription('Nuevo detalle de la sede').setMaxLength(200))
      .addStringOption(o => o.setName('lider').setDescription('Nuevo líder').setMaxLength(200))
      .addStringOption(o => o.setName('frecuencia').setDescription('Nueva frecuencia').setMaxLength(60))
      .addStringOption(o => o.setName('actividad').setDescription('Nueva actividad').setMaxLength(80))
      .addStringOption(o => o.setName('armamento').setDescription('Nuevo armamento').setMaxLength(200))
      .addStringOption(o => o.setName('foto').setDescription('Nuevo link de foto').setMaxLength(300))
      .addStringOption(o => o.setName('estado').setDescription('Nuevo estado')
        .addChoices({ name: '🟢 Activa', value: 'activa' }, { name: '🟡 En observación', value: 'observacion' }, { name: '⚫ Desarticulada', value: 'desarticulada' }))
      .addStringOption(o => o.setName('notas').setDescription('Reemplaza las notas').setMaxLength(900))
      .addStringOption(o => o.setName('sumar_nota').setDescription('Agrega una línea a las notas').setMaxLength(400)))
    .addSubcommand(s => s.setName('eliminar').setDescription('[INTEL] Elimina el legajo de una organización')
      .addStringOption(o => o.setName('buscar').setDescription('Elegí de la lista').setRequired(true).setAutocomplete(true)));

  const legajoCmd = new SlashCommandBuilder()
    .setName('legajo')
    .setDescription('Legajos de personas')
    .addSubcommand(s => s.setName('crear').setDescription('[INTEL] Abre el legajo de una persona')
      .addStringOption(o => o.setName('nombre').setDescription('Nombre IC').setRequired(true).setMaxLength(80))
      .addStringOption(o => o.setName('alias').setDescription('Alias o apodo').setMaxLength(60))
      .addStringOption(o => o.setName('organizacion').setDescription('Organización de la lista').setAutocomplete(true))
      .addStringOption(o => o.setName('rango').setDescription('Rango dentro de la organización').setMaxLength(60))
      .addStringOption(o => o.setName('estado').setDescription('Situación')
        .addChoices({ name: '🟢 Libre', value: 'libre' }, { name: '🔵 Detenido', value: 'detenido' }, { name: '🔴 Prófugo', value: 'profugo' }, { name: '⚫ Muerto', value: 'muerto' }))
      .addStringOption(o => o.setName('notas').setDescription('Observaciones iniciales').setMaxLength(900)))
    .addSubcommand(s => s.setName('info').setDescription('[INTEL] Consulta un legajo')
      .addStringOption(o => o.setName('buscar').setDescription('Elegí de la lista o escribí para filtrar').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('actualizar').setDescription('[INTEL] Actualiza un legajo existente')
      .addStringOption(o => o.setName('buscar').setDescription('Elegí de la lista o escribí para filtrar').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('alias').setDescription('Nuevo alias').setMaxLength(60))
      .addStringOption(o => o.setName('organizacion').setDescription('Vincular a organización').setAutocomplete(true))
      .addStringOption(o => o.setName('rango').setDescription('Nuevo rango').setMaxLength(60))
      .addStringOption(o => o.setName('estado').setDescription('Nueva situación')
        .addChoices({ name: '🟢 Libre', value: 'libre' }, { name: '🔵 Detenido', value: 'detenido' }, { name: '🔴 Prófugo', value: 'profugo' }, { name: '⚫ Muerto', value: 'muerto' }))
      .addStringOption(o => o.setName('notas').setDescription('Reemplaza las notas').setMaxLength(900))
      .addStringOption(o => o.setName('sumar_nota').setDescription('Agrega una línea a las notas').setMaxLength(400)))
    .addSubcommand(s => s.setName('eliminar').setDescription('[INTEL] Elimina el legajo de una persona')
      .addStringOption(o => o.setName('buscar').setDescription('Elegí de la lista').setRequired(true).setAutocomplete(true)));

  const procedimientoCmd = new SlashCommandBuilder()
    .setName('procedimiento')
    .setDescription('[HEAD] Publica un procedimiento de interpretación con su bloque copiable')
    .addStringOption(o => {
      o.setName('nombre').setDescription('Procedimiento a publicar').setRequired(true);
      for (const p of PROCEDIMIENTOS.slice(0, 25)) o.addChoices({ name: p.nombre, value: p.valor });
      return o;
    })
    .addAttachmentOption(o => o.setName('video').setDescription('Video demostrativo (archivo, sujeto al límite de subida del servidor)').setRequired(false))
    .addStringOption(o => o.setName('video_url').setDescription('Link al video (YouTube, Medal, Streamable) — sin límite de peso').setRequired(false).setMaxLength(300));

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    for (const [gid] of client.guilds.cache) {
      const actuales = await rest.get(Routes.applicationGuildCommands(client.user.id, gid));
      if (actuales.length > 0) {
        await rest.put(Routes.applicationGuildCommands(client.user.id, gid), { body: [] });
        console.log(`[LIMPIEZA] Borrados ${actuales.length} comandos fantasma de guild ${gid}.`);
      }
    }
  } catch (e) { console.error('[LIMPIEZA] Error:', e.message); }

  try {
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: [geofCmd.toJSON(), normativasCmd.toJSON(), jerarquiaCmd.toJSON(), mafiaCmd.toJSON(), legajoCmd.toJSON(), procedimientoCmd.toJSON()]
    });
    console.log('Comandos globales registrados: /geof, /normativas, /jerarquia, /mafia, /legajo, /procedimiento');
  } catch (err) { console.error('Error registrando comandos:', err); }
});

// ==================== INTERACTIONS ====================
client.on('interactionCreate', async (interaction) => {

  // ==================== AUTOCOMPLETADO ====================
  if (interaction.isAutocomplete()) {
    if (!db) { await interaction.respond([]).catch(() => {}); return; }
    try {
      const foco = interaction.options.getFocused(true);
      const q = (foco.value || '').trim();
      const esOrg = (interaction.commandName === 'mafia') || (foco.name === 'organizacion');
      const tabla = esOrg ? 'organizaciones' : 'personas';
      const cols = esOrg ? 'expediente,nombre,estado' : 'expediente,nombre,alias,estado';
      let sel = db.from(tabla).select(cols).order('nombre').limit(25);
      if (q) {
        const filtros = [`nombre.ilike.%${q}%`, `expediente.ilike.%${q}%`];
        if (!esOrg) filtros.push(`alias.ilike.%${q}%`);
        sel = sel.or(filtros.join(','));
      }
      const { data, error } = await sel;
      if (error) { await interaction.respond([]).catch(() => {}); return; }
      const mapa = esOrg ? EST_MAFIA : EST_PERSONA;
      const opciones = (data || []).map(r => {
        const e = mapa[r.estado] || Object.values(mapa)[0];
        const alias = r.alias ? ` "${r.alias}"` : '';
        return { name: trunc(`${e.emoji} ${r.nombre}${alias} · ${r.expediente}`, 100), value: r.expediente };
      });
      await interaction.respond(opciones).catch(() => {});
    } catch (e) {
      await interaction.respond([]).catch(() => {});
    }
    return;
  }

  if (!botListo) {
    try {
      if (interaction.isRepliable()) await interaction.reply({ content: '⏳ El bot está iniciando. Intentá en unos segundos.', ephemeral: true });
    } catch (e) { }
    return;
  }

  // ==================== MODALES POSTULACIÓN ====================
  if (interaction.isModalSubmit() && interaction.customId === 'POSTULAR_MODAL_1') {
    const uid = interaction.user.id;
    if (!postulacionesActivas[uid]) {
      await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Expediente inválido').setDescription('Tu postulación ya no está activa. Volvé a iniciarla desde el panel.')], ephemeral: true });
      return;
    }
    const confirm = interaction.fields.getTextInputValue('m1_confirm').trim().toUpperCase();
    if (confirm !== 'ACEPTO') {
      delete postulacionesActivas[uid];
      guardarPostulacionesActivas().catch(e => console.error(e));
      await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Confirmación inválida').setDescription('Debías escribir **`ACEPTO`** exactamente. Tu expediente fue cerrado.')], ephemeral: true });
      return;
    }
    postulacionesActivas[uid].datos.nombre     = interaction.fields.getTextInputValue('m1_nombre');
    postulacionesActivas[uid].datos.rango      = interaction.fields.getTextInputValue('m1_rango');
    postulacionesActivas[uid].datos.disp       = interaction.fields.getTextInputValue('m1_disp');
    postulacionesActivas[uid].datos.diferencia = interaction.fields.getTextInputValue('m1_diferencia');
    guardarPostulacionesActivas().catch(e => console.error(e));

    const minutos = Math.max(0, Math.ceil((postulacionesActivas[uid].expiraTs - Date.now()) / 60000));
    const embed = embedBase(COLOR.EXITO)
      .setAuthor({ name: 'G.E.O.F • Sistema de Postulaciones' })
      .setTitle('✅ Paso 1/4 completado')
      .setDescription(`Datos personales registrados.\n\n${DIV}\n\n**Siguiente:** Evaluación Táctica — Parte I\n**Tiempo restante:** ⏳ **${minutos} minutos**`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('POSTULAR_SIG_2').setLabel('Continuar → Táctica I').setStyle(ButtonStyle.Primary).setEmoji('📖')
    );
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'POSTULAR_MODAL_2') {
    const uid = interaction.user.id;
    if (!postulacionesActivas[uid]) {
      await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Expediente inválido').setDescription('Tu postulación ya no está activa.')], ephemeral: true });
      return;
    }
    postulacionesActivas[uid].datos.nvl          = interaction.fields.getTextInputValue('m2_nvl');
    postulacionesActivas[uid].datos.no_amenazar  = interaction.fields.getTextInputValue('m2_no_amenazar');
    postulacionesActivas[uid].datos.rehenes      = interaction.fields.getTextInputValue('m2_rehenes');
    postulacionesActivas[uid].datos.secuestro    = interaction.fields.getTextInputValue('m2_secuestro');
    postulacionesActivas[uid].datos.ingreso      = interaction.fields.getTextInputValue('m2_ingreso');
    guardarPostulacionesActivas().catch(e => console.error(e));

    const minutos = Math.max(0, Math.ceil((postulacionesActivas[uid].expiraTs - Date.now()) / 60000));
    const embed = embedBase(COLOR.EXITO)
      .setAuthor({ name: 'G.E.O.F • Sistema de Postulaciones' })
      .setTitle('✅ Paso 2/4 completado')
      .setDescription(`Evaluación Táctica I registrada.\n\n${DIV}\n\n**Siguiente:** Evaluación Táctica — Parte II\n**Tiempo restante:** ⏳ **${minutos} minutos**`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('POSTULAR_SIG_3').setLabel('Continuar → Táctica II').setStyle(ButtonStyle.Primary).setEmoji('🛡️')
    );
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'POSTULAR_MODAL_3') {
    const uid = interaction.user.id;
    if (!postulacionesActivas[uid]) {
      await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Expediente inválido').setDescription('Tu postulación ya no está activa.')], ephemeral: true });
      return;
    }
    postulacionesActivas[uid].datos.perimetro    = interaction.fields.getTextInputValue('m3_perimetro');
    postulacionesActivas[uid].datos.por_que      = interaction.fields.getTextInputValue('m3_por_que');
    postulacionesActivas[uid].datos.iniciativa   = interaction.fields.getTextInputValue('m3_iniciativa');
    postulacionesActivas[uid].datos.negociador   = interaction.fields.getTextInputValue('m3_negociador');
    guardarPostulacionesActivas().catch(e => console.error(e));

    const minutos = Math.max(0, Math.ceil((postulacionesActivas[uid].expiraTs - Date.now()) / 60000));
    const embed = embedBase(COLOR.EXITO)
      .setAuthor({ name: 'G.E.O.F • Sistema de Postulaciones' })
      .setTitle('✅ Paso 3/4 completado')
      .setDescription(`Táctica avanzada y motivación registradas.\n\n${DIV}\n\n**Último paso:** Escenario Táctico Final\n**Tiempo restante:** ⏳ **${minutos} minutos**`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('POSTULAR_SIG_4').setLabel('Continuar → Escenario Final').setStyle(ButtonStyle.Primary).setEmoji('🎯')
    );
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'POSTULAR_MODAL_4') {
    const uid = interaction.user.id;
    if (!postulacionesActivas[uid]) {
      await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Expediente inválido').setDescription('Tu postulación ya no está activa.')], ephemeral: true });
      return;
    }
    postulacionesActivas[uid].datos.situacion = interaction.fields.getTextInputValue('m4_situacion');
    const d = postulacionesActivas[uid].datos;
    const exp = postulacionesActivas[uid].expediente;

    const embed1 = new EmbedBuilder()
      .setAuthor({ name: 'G.E.O.F • Nueva Postulación Recibida', iconURL: interaction.user.displayAvatarURL() })
      .setTitle(`📋 EXPEDIENTE ${exp}`)
      .setDescription(`**Estado:** \`PENDIENTE DE EVALUACIÓN\`\n${DIV}\n**◾ Postulante**`)
      .setColor(COLOR.PENDIENTE)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '👤 Nombre IC',      value: '```' + trunc(d.nombre, 60) + '```', inline: true },
        { name: '🎖️ Rango PFA',     value: '```' + trunc(d.rango, 60) + '```',  inline: true },
        { name: '📅 Disponibilidad', value: '```' + trunc(d.disp, 60) + '```',   inline: true },
        { name: '🔗 Discord',        value: `<@${uid}>`, inline: true },
        { name: '🆔 ID',             value: '`' + uid + '`', inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: `${DIV}\n💬 Diferenciación`, value: `> ${trunc(d.diferencia, 400)}`, inline: false },
        { name: '📖 NVL + ejemplo', value: `> ${trunc(d.nvl, 400)}`, inline: false },
        { name: '🚫 Por qué no amenazar', value: `> ${trunc(d.no_amenazar, 400)}`, inline: false },
        { name: '🎭 Toma de rehenes', value: `> ${trunc(d.rehenes, 400)}`, inline: false }
      )
      .setFooter({ text: `Parte 1/2 • Expediente ${exp}` });

    const embed2 = new EmbedBuilder()
      .setColor(COLOR.PENDIENTE)
      .setDescription(`**◾ Continuación** — Expediente \`${exp}\``)
      .addFields(
        { name: '⚠️ Secuestro', value: `> ${trunc(d.secuestro, 400)}`, inline: false },
        { name: '🚪 Ingreso táctico', value: `> ${trunc(d.ingreso, 400)}`, inline: false },
        { name: '📍 Perímetro', value: `> ${trunc(d.perimetro, 400)}`, inline: false },
        { name: `${DIV}\n❓ ¿Por qué G.E.O.F?`, value: `> ${trunc(d.por_que, 400)}`, inline: false },
        { name: '⚙️ Órdenes vs iniciativa', value: `> ${trunc(d.iniciativa, 400)}`, inline: false },
        { name: '🗣️ ¿Quién negocia?', value: `> ${trunc(d.negociador, 400)}`, inline: false },
        { name: `${DIV}\n🎬 Escenario táctico final`, value: `> ${trunc(d.situacion, 400)}`, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `Parte 2/2 • G.E.O.F • Recibido` });

    const mencionRoles = ROLES_AUTORIZADOS.map(r => '<@&' + r + '>').join(' ');
    const nombreLimpio = (d.nombre || 'postulante').replace(/[^a-zA-Z0-9]/g, '').slice(0, 30) || 'postulante';
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ap_' + Date.now() + '_' + nombreLimpio + '_' + uid).setLabel('APROBAR').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId('re_' + Date.now() + '_' + nombreLimpio + '_' + uid).setLabel('RECHAZAR').setStyle(ButtonStyle.Danger).setEmoji('❌')
    );

    try {
      const canalAprob = await client.channels.fetch(CANAL_APROBACION);
      await canalAprob.send({ content: mencionRoles, embeds: [embed1, embed2], components: [row], allowedMentions: { roles: ROLES_AUTORIZADOS } });
    } catch (e) {
      console.error('[POSTULAR MODAL 4] Error publicando expediente:', e);
      await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Error al enviar expediente').setDescription(`No se pudo publicar tu expediente. Tus respuestas siguen guardadas — presioná el botón del panel para reintentar.\n\n_Error: ${e.message || 'desconocido'}_`)], ephemeral: true });
      return;
    }

    if (postulacionesActivas[uid].timeoutId) clearTimeout(postulacionesActivas[uid].timeoutId);
    delete postulacionesActivas[uid];
    guardarPostulacionesActivas().catch(e => console.error(e));

    const embedOk = embedBase(COLOR.APROBADO)
      .setAuthor({ name: 'G.E.O.F • Postulación Recibida' })
      .setTitle('📨 Expediente enviado')
      .setDescription(`Tu postulación fue registrada bajo el expediente **\`${exp}\`**.\n\n${DIV}\n\n**◾ Próximos pasos**\n${SEP} La oficialidad revisará tu examen\n${SEP} Se te notificará por **mensaje privado**\n${SEP} Aprobación o rechazo será comunicado en las próximas horas\n\n${DIV}\n\n> _Se agradece tu interés en formar parte del Grupo Especial de Operaciones Federales._`);
    await interaction.reply({ embeds: [embedOk], ephemeral: true });
    return;
  }

  // ==================== MODAL OPERATIVO ====================
  if (interaction.isModalSubmit() && interaction.customId === 'modal_operativo') {
    const tipo        = interaction.fields.getTextInputValue('op_tipo');
    const hora        = interaction.fields.getTextInputValue('op_hora');
    const lugar       = interaction.fields.getTextInputValue('op_lugar');
    const descripcion = interaction.fields.getTextInputValue('op_descripcion');
    const requisitos  = interaction.fields.getTextInputValue('op_requisitos') || 'Toda la unidad';

    await interaction.deferReply({ ephemeral: true });

    const v = { titulo: tipo, hora, lugar, descripcion, requisitos, autor: interaction.user.id, cerrada: false, votos: {} };

    try {
      const canalOp = await client.channels.fetch(CANAL_OPERATIVOS);
      const rowPlaceholder = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('VOTO_placeholder').setLabel('ASISTO').setStyle(ButtonStyle.Success).setEmoji('✅').setDisabled(true)
      );
      const msgEnviado = await canalOp.send({
        content: '<@&' + ROL_GEOF + '>',
        embeds: [construirEmbedVotacion(v)],
        components: [rowPlaceholder],
        allowedMentions: { roles: [ROL_GEOF] }
      });
      votaciones[msgEnviado.id] = v;
      guardarVotaciones().catch(e => console.error(e));
      await msgEnviado.edit({ components: [filaBotonesVotacion(msgEnviado.id, false)] });
      await interaction.editReply({ embeds: [embedBase(COLOR.EXITO).setTitle('✅ Operativo publicado').setDescription(`El operativo fue publicado en <#${CANAL_OPERATIVOS}>.`)] });
    } catch (e) {
      console.error('[OPERATIVO] Error:', e);
      try { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Error al publicar').setDescription(`\`${e.message || 'error desconocido'}\``)] }); } catch (e2) {}
    }
    return;
  }

  // ==================== BOTONES ====================
  if (interaction.isButton()) {
    const id = interaction.customId;

    if (id === 'DEL_CANCELAR') {
      await interaction.update({ embeds: [embedBase(COLOR.BASE).setTitle('✖️ Cancelado').setDescription('No se eliminó nada.')], components: [] });
      return;
    }

    if (id.startsWith('DEL_MAF_') || id.startsWith('DEL_LEG_')) {
      if (!db) { await interaction.update({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Sin base de datos')], components: [] }); return; }
      if (!tienePermiso(interaction.member, RAMA_INTEL)) {
        await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Sin permisos').setDescription('Sólo la rama de Inteligencia puede eliminar legajos.')], ephemeral: true });
        return;
      }
      const esMafia = id.startsWith('DEL_MAF_');
      const regId = parseInt(id.replace(esMafia ? 'DEL_MAF_' : 'DEL_LEG_', ''), 10);
      const tabla = esMafia ? 'organizaciones' : 'personas';
      const foro = esMafia ? FORO_MAFIAS : FORO_PERSONAS;

      try {
        const { data: reg } = await db.from(tabla).select('*').eq('id', regId).maybeSingle();
        if (!reg) {
          await interaction.update({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Ya no existe')], components: [] });
          return;
        }
        if (reg.thread_id) {
          try {
            const hilo = await client.channels.fetch(reg.thread_id);
            const inicial = await hilo.fetchStarterMessage();
            const embMarcado = EmbedBuilder.from(inicial.embeds[0]).setColor(COLOR.EXPULSION).setTitle(`🗑️ [ELIMINADO] ${inicial.embeds[0].title.replace(/^🗂️ |^👤 /, '')}`);
            await inicial.edit({ embeds: [embMarcado] });
            await hilo.setName(trunc(`🗑️ ${reg.nombre}`, 90)).catch(() => {});
            await hilo.setArchived(true).catch(() => {});
          } catch (e) { console.warn('[LEGAJOS] No se pudo marcar el post:', e.message); }
        }
        const { error } = await db.from(tabla).delete().eq('id', regId);
        if (error) throw new Error(error.message);
        await interaction.update({ embeds: [embedBase(COLOR.EXITO).setTitle('🗑️ Legajo eliminado').setDescription(`\`${reg.expediente}\` — **${reg.nombre}** fue eliminado.`)], components: [] });
      } catch (e) {
        await interaction.update({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Error al eliminar').setDescription(`\`${e.message}\``)], components: [] });
      }
      return;
    }

    if (id.startsWith('VOTO_SI_') || id.startsWith('VOTO_NO_')) {
      const esSi = id.startsWith('VOTO_SI_');
      const msgId = id.replace(esSi ? 'VOTO_SI_' : 'VOTO_NO_', '');
      const v = votaciones[msgId];
      const uid = interaction.user.id;
      if (!v) { await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Votación no encontrada')], ephemeral: true }); return; }
      if (v.cerrada) { await interaction.reply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('🔒 Votación cerrada')], ephemeral: true }); return; }
      if (!interaction.member.roles.cache.has(ROL_GEOF)) {
        await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Sin permisos').setDescription('Solo los miembros del **G.E.O.F** pueden votar.')], ephemeral: true });
        return;
      }
      if (v.votos[uid]) {
        const yaVoto = v.votos[uid] === 'si' ? 'ASISTO ✅' : 'NO ASISTO ❌';
        await interaction.reply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('🔒 Ya votaste').setDescription(`Tu voto (**${yaVoto}**) ya quedó registrado y **no se puede cambiar ni retirar**.`)], ephemeral: true });
        return;
      }
      v.votos[uid] = esSi ? 'si' : 'no';
      guardarVotaciones().catch(e => console.error(e));
      try {
        await interaction.update({ embeds: [construirEmbedVotacion(v)], components: [filaBotonesVotacion(msgId, false)] });
      } catch (e) {
        await interaction.reply({ embeds: [embedBase(COLOR.EXITO).setTitle('✅ Voto registrado')], ephemeral: true });
      }
      return;
    }

    if (id.startsWith('VOTO_CERRAR_')) {
      const msgId = id.replace('VOTO_CERRAR_', '');
      const v = votaciones[msgId];
      if (!v) { await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Votación no encontrada')], ephemeral: true }); return; }
      if (!tienePermiso(interaction.member, JEFATURA)) {
        await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Sin permisos')], ephemeral: true });
        return;
      }
      v.cerrada = true;
      guardarVotaciones().catch(e => console.error(e));
      await interaction.update({ embeds: [construirEmbedVotacion(v)], components: [filaBotonesVotacion(msgId, true)] });
      return;
    }

    // POSTULAR — iniciar expediente
    if (id === 'POSTULAR_INICIAR') {
      const uid = interaction.user.id;
      const esDueno = interaction.member.roles.cache.has(ROL_DUENO_GEOF);

      // Dueño: saltea cooldown y postulación activa sin restricción
      if (!esDueno) {
        const cooldownHasta = estaEnCooldown(uid);
        if (cooldownHasta) {
          await interaction.reply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⏳ Cooldown activo').setDescription(`Podés volver a intentar <t:${Math.floor(cooldownHasta / 1000)}:R>.`)], ephemeral: true });
          return;
        }
        if (postulacionesActivas[uid]) {
          const minutos = Math.max(0, Math.ceil((postulacionesActivas[uid].expiraTs - Date.now()) / 60000));
          await interaction.reply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('📋 Ya tenés una postulación activa').setDescription(`Expediente **\`${postulacionesActivas[uid].expediente}\`**\nTiempo restante: **${minutos} minutos**`)], ephemeral: true });
          return;
        }
        if (TODOS_ROLES_GEOF.some(r => interaction.member.roles.cache.has(r))) {
          await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Ya sos parte del G.E.O.F')], ephemeral: true });
          return;
        }
      } else {
        // Dueño: limpiar cualquier postulación activa para poder empezar de nuevo
        if (postulacionesActivas[uid]) {
          if (postulacionesActivas[uid].timeoutId) clearTimeout(postulacionesActivas[uid].timeoutId);
          delete postulacionesActivas[uid];
        }
      }

      const expediente = generarExpediente();
      postulacionesActivas[uid] = {
        inicio: Date.now(),
        expiraTs: Date.now() + TIEMPO_MAX_POSTULACION_MS,
        expediente,
        timeoutId: null,
        datos: {}
      };
      iniciarTimeoutPostulacion(uid);
      guardarPostulacionesActivas().catch(e => console.error(e));

      const modal = new ModalBuilder().setCustomId('POSTULAR_MODAL_1').setTitle(`Expediente ${expediente} • Datos (1/4)`);
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m1_nombre').setLabel('Nombre IC en el server').setStyle(TextInputStyle.Short).setRequired(true).setMinLength(2).setMaxLength(60)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m1_rango').setLabel('Rango actual en la PFA').setStyle(TextInputStyle.Short).setRequired(true).setMinLength(2).setMaxLength(60)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m1_disp').setLabel('Días disponibles por semana').setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(30)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m1_diferencia').setLabel('¿Qué te diferencia de otros postulantes?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(800)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m1_confirm').setLabel('Escribí "ACEPTO" para confirmar').setStyle(TextInputStyle.Short).setRequired(true).setMinLength(6).setMaxLength(10).setPlaceholder('ACEPTO'))
      );
      await interaction.showModal(modal);
      return;
    }

    if (id.startsWith('POSTULAR_SIG_')) {
      const paso = id.replace('POSTULAR_SIG_', '');
      const uid = interaction.user.id;
      if (!postulacionesActivas[uid]) {
        await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Expediente inválido').setDescription('Tu postulación ya no está activa.')], ephemeral: true });
        return;
      }
      const exp = postulacionesActivas[uid].expediente;

      if (paso === '2') {
        const modal = new ModalBuilder().setCustomId('POSTULAR_MODAL_2').setTitle(`Expediente ${exp} • Táctica I (2/4)`);
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m2_nvl').setLabel('¿Qué es el NVL? Poné un ejemplo').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(600)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m2_no_amenazar').setLabel('¿Por qué NO se debe amenazar al sospechoso?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(600)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m2_rehenes').setLabel('¿Cómo actuarías en una toma de rehenes?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(600)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m2_secuestro').setLabel('¿Cómo actuarías en un secuestro?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(600)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m2_ingreso').setLabel('¿Cómo se hace un ingreso táctico?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(600))
        );
        await interaction.showModal(modal);
        return;
      }
      if (paso === '3') {
        const modal = new ModalBuilder().setCustomId('POSTULAR_MODAL_3').setTitle(`Expediente ${exp} • Táctica II (3/4)`);
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m3_perimetro').setLabel('¿Qué es un perímetro y cómo se arma?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(700)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m3_por_que').setLabel('¿Por qué querés ser parte del G.E.O.F?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(30).setMaxLength(1000)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m3_iniciativa').setLabel('¿Seguir órdenes o tomar iniciativa?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(700)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m3_negociador').setLabel('¿Quién negocia en una toma de rehenes?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(600))
        );
        await interaction.showModal(modal);
        return;
      }
      if (paso === '4') {
        const modal = new ModalBuilder().setCustomId('POSTULAR_MODAL_4').setTitle(`Expediente ${exp} • Escenario (4/4)`);
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m4_situacion').setLabel('Escenario táctico final').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(50).setMaxLength(1500).setPlaceholder('2 rehenes en tienda. Exigen vehículo + negociador. Sos el primer GEOF. ¿Cómo negociás?'))
        );
        await interaction.showModal(modal);
        return;
      }
      return;
    }

    // APROBAR / RECHAZAR expediente
    if (id.startsWith('ap_') || id.startsWith('re_')) {
      const tieneRol = tienePermiso(interaction.member, JEFATURA);
      if (!tieneRol) {
        await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Sin permisos').setDescription('No estás autorizado para evaluar postulaciones.')], ephemeral: true });
        return;
      }
      await interaction.deferUpdate();
      const parts = id.split('_');
      const accion = parts[0], discordId = parts[3];
      const revisor = interaction.member?.displayName || interaction.user.username;

      try {
        if (accion === 'ap') {
          if (!discordId) {
            const rowDone = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('done_ap').setLabel(`APROBADO por ${revisor}`).setStyle(ButtonStyle.Success).setDisabled(true).setEmoji('✅'),
              new ButtonBuilder().setCustomId('done_re').setLabel('RECHAZAR').setStyle(ButtonStyle.Danger).setDisabled(true).setEmoji('❌')
            );
            await interaction.editReply({ components: [rowDone] });
            return;
          }
          let miembro;
          try { miembro = await interaction.guild.members.fetch(discordId); }
          catch (e) {
            await interaction.followUp({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Postulante no encontrado')], ephemeral: true });
            return;
          }
          try {
            // Asignar rol Táctico (base) + ROL_MIEMBRO_GEOF (el que pidió en esta sesión)
            for (const r of [ROL_GEOF, ROL_TACTICO, ROL_MIEMBRO_GEOF]) {
              if (!miembro.roles.cache.has(r)) await miembro.roles.add(r, 'Ingreso G.E.O.F por aprobación');
            }
          } catch (e) {
            console.error('Error asignando roles:', e.message);
            await interaction.followUp({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Aprobado con advertencia').setDescription('No se pudo asignar los roles. Verificá la jerarquía del bot.')], ephemeral: true });
          }

          // Update en canal con mención al aprobado
          const embedIngreso = new EmbedBuilder()
            .setAuthor({ name: 'G.E.O.F • Registro de Ingresos' })
            .setTitle('🎯 NUEVO INGRESO CONFIRMADO')
            .setDescription(`<@${discordId}> ha sido incorporado oficialmente al **G.E.O.F**.\n${DIV}`)
            .setColor(COLOR.APROBADO)
            .setThumbnail(miembro.displayAvatarURL())
            .addFields(
              { name: '👮 Evaluado por', value: `<@${interaction.user.id}>`, inline: true },
              { name: '📅 Fecha',        value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
              { name: '\u200B', value: `${DIV}\n> _Bienvenido al Grupo Especial de Operaciones Federales._`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'G.E.O.F • Sistema de Ingresos' });
          try {
            const canalUp = await client.channels.fetch(CANAL_UPDATES);
            // ACTUALIZACIÓN: @postulante > NUEVO @rol
            await canalUp.send({ content: `📋 **Update:** <@${discordId}> **> NUEVO** <@&${ROL_MIEMBRO_GEOF}>`, embeds: [embedIngreso] });
          } catch (e) { console.error('Publicar ingreso:', e.message); }

          // DM al aprobado
          try {
            const embedDM = new EmbedBuilder()
              .setTitle('✅ ¡Fuiste APROBADO en el G.E.O.F!')
              .setDescription(`Felicitaciones. Fuiste incorporado al **Grupo Especial de Operaciones Federales**.\n${DIV}`)
              .setColor(COLOR.APROBADO)
              .addFields(
                { name: '👮 Evaluado por', value: revisor, inline: true },
                { name: '\u200B', value: `${SEP} Los roles ya fueron asignados\n${SEP} Presentate en los próximos operativos`, inline: false }
              )
              .setTimestamp()
              .setFooter({ text: 'G.E.O.F • Kilombo RP' });
            await miembro.send({ embeds: [embedDM] });
          } catch (e) { /* DM cerrado */ }

          const rowDone = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('done_ap').setLabel(`APROBADO por ${revisor}`).setStyle(ButtonStyle.Success).setDisabled(true).setEmoji('✅'),
            new ButtonBuilder().setCustomId('done_re').setLabel('RECHAZAR').setStyle(ButtonStyle.Danger).setDisabled(true).setEmoji('❌')
          );
          const embedsOriginales = interaction.message.embeds.map(e => EmbedBuilder.from(e).setColor(COLOR.APROBADO));
          if (embedsOriginales[0]) {
            const desc = embedsOriginales[0].data.description || '';
            embedsOriginales[0].setDescription(desc.replace('`PENDIENTE DE EVALUACIÓN`', '`✅ APROBADO`'));
          }
          await interaction.editReply({ embeds: embedsOriginales, components: [rowDone] });

        } else {
          // RECHAZAR
          if (!discordId) {
            const rowDone = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('done_ap').setLabel('APROBAR').setStyle(ButtonStyle.Success).setDisabled(true).setEmoji('✅'),
              new ButtonBuilder().setCustomId('done_re').setLabel(`RECHAZADO por ${revisor}`).setStyle(ButtonStyle.Danger).setDisabled(true).setEmoji('❌')
            );
            await interaction.editReply({ components: [rowDone] });
            return;
          }
          // Cooldown de 24h solo al rechazar manualmente
          postulacionesCooldown[discordId] = Date.now() + COOLDOWN_POSTULACION_MS;
          guardarCooldowns().catch(e => console.error(e));

          // Update en canal con mención al rechazado
          try {
            const canalUp = await client.channels.fetch(CANAL_UPDATES);
            await canalUp.send(`📋 **Update:** <@${discordId}> **> No aprobaste el examen, intentalo nuevamente en 24 horas.**`);
          } catch (e) { console.error('Error update rechazo:', e.message); }

          try {
            const miembro = await interaction.guild.members.fetch(discordId);
            const embedDM = new EmbedBuilder()
              .setTitle('❌ Postulación no aprobada')
              .setDescription(`Tu postulación al **G.E.O.F** no fue aprobada.\n${DIV}`)
              .setColor(COLOR.RECHAZADO)
              .addFields(
                { name: '👮 Evaluado por', value: revisor, inline: true },
                { name: '⏳ Cooldown', value: '**24 horas**', inline: true },
                { name: '\u200B', value: `> Podés volver a postularte una vez transcurrido el período de espera.`, inline: false }
              )
              .setTimestamp()
              .setFooter({ text: 'G.E.O.F • Kilombo RP' });
            await miembro.send({ embeds: [embedDM] });
          } catch (e) { console.error('Error DM rechazo:', e.message); }

          const rowDone = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('done_ap').setLabel('APROBAR').setStyle(ButtonStyle.Success).setDisabled(true).setEmoji('✅'),
            new ButtonBuilder().setCustomId('done_re').setLabel(`RECHAZADO por ${revisor}`).setStyle(ButtonStyle.Danger).setDisabled(true).setEmoji('❌')
          );
          const embedsOriginales = interaction.message.embeds.map(e => EmbedBuilder.from(e).setColor(COLOR.RECHAZADO));
          if (embedsOriginales[0]) {
            const desc = embedsOriginales[0].data.description || '';
            embedsOriginales[0].setDescription(desc.replace('`PENDIENTE DE EVALUACIÓN`', '`❌ RECHAZADO`'));
          }
          await interaction.editReply({ embeds: embedsOriginales, components: [rowDone] });
        }
      } catch (err) { console.error('Error postulacion:', err); }
      return;
    }
    return;
  }

  // ==================== SLASH COMMANDS ====================
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction.commandName;
  if (!['geof','normativas','jerarquia','mafia','legajo','procedimiento'].includes(cmd)) return;

  const revisor = interaction.member?.displayName || interaction.user.username;
  const sub = ['geof', 'mafia', 'legajo'].includes(cmd) ? interaction.options.getSubcommand() : null;
  const esOperativo = (cmd === 'geof' && sub === 'operativo');
  const esIntel = (cmd === 'mafia' || cmd === 'legajo');
  const grupoRequerido = esIntel ? RAMA_INTEL : esOperativo ? MANDO_OPERATIVO : JEFATURA;

  if (!tienePermiso(interaction.member, grupoRequerido)) {
    const desc = esIntel ? 'Reservado a la **rama de Inteligencia**.' : esOperativo ? 'Requiere **Jefatura** o **especialidad**.' : 'Reservado a la **Jefatura del G.E.O.F**.';
    await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Sin permisos').setDescription(desc)], ephemeral: true });
    return;
  }

  if (esIntel && !db) {
    await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Base de datos no configurada').setDescription('Faltan las variables `SUPABASE_URL` y `SUPABASE_KEY`.')], ephemeral: true });
    return;
  }

  // ==================== /mafia ====================
  if (cmd === 'mafia') {
    await interaction.deferReply({ ephemeral: true });
    try {
      if (sub === 'crear') {
        const nombre = interaction.options.getString('nombre').trim();
        const dup = await db.from('organizaciones').select('expediente,nombre').ilike('nombre', nombre).maybeSingle();
        if (dup.data) { await interaction.editReply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Ya existe').setDescription(`**${dup.data.nombre}** ya tiene legajo: \`${dup.data.expediente}\``)] }); return; }
        const expediente = await nuevoExpediente('MAF');
        const { data, error } = await db.from('organizaciones').insert({
          expediente, nombre,
          cp: interaction.options.getInteger('cp'), sede_nota: interaction.options.getString('sede_nota'),
          lider: interaction.options.getString('lider'), frecuencia: interaction.options.getString('frecuencia'),
          actividad: interaction.options.getString('actividad'), armamento: interaction.options.getString('armamento'),
          foto: interaction.options.getString('foto'), estado: interaction.options.getString('estado') || 'activa',
          notas: interaction.options.getString('notas'), creado_por: interaction.user.id
        }).select().single();
        if (error) throw new Error(error.message);
        const hiloId = await sincronizarPost(FORO_MAFIAS, data, embedMafia(data, []), 'organizaciones');
        await interaction.editReply({ embeds: [embedBase(COLOR.EXITO).setTitle('✅ Legajo abierto').setDescription(`**${nombre}** — \`${expediente}\`\n\n<#${hiloId}>`)] });
        return;
      }
      if (sub === 'info') {
        const m = await buscarRegistro('organizaciones', interaction.options.getString('buscar'));
        if (!m) { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Sin resultados')] }); return; }
        const { data: integrantes } = await db.from('personas').select('*').eq('organizacion_id', m.id).order('nombre');
        await interaction.editReply({ embeds: [embedMafia(m, integrantes || [])] });
        return;
      }
      if (sub === 'actualizar') {
        const m = await buscarRegistro('organizaciones', interaction.options.getString('buscar'));
        if (!m) { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Sin resultados')] }); return; }
        const cambios = { actualizado_en: new Date().toISOString() };
        for (const f of ['sede_nota', 'lider', 'frecuencia', 'actividad', 'armamento', 'foto', 'estado', 'notas']) {
          const v = interaction.options.getString(f); if (v !== null) cambios[f] = v;
        }
        const cpNuevo = interaction.options.getInteger('cp'); if (cpNuevo !== null) cambios.cp = cpNuevo;
        const sumar = interaction.options.getString('sumar_nota');
        if (sumar) cambios.notas = (m.notas ? m.notas + '\n' : '') + `• ${sumar}`;
        if (Object.keys(cambios).length === 1) { await interaction.editReply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Nada que actualizar')] }); return; }
        const { data, error } = await db.from('organizaciones').update(cambios).eq('id', m.id).select().single();
        if (error) throw new Error(error.message);
        const { data: integrantes } = await db.from('personas').select('*').eq('organizacion_id', data.id).order('nombre');
        const hiloId = await sincronizarPost(FORO_MAFIAS, data, embedMafia(data, integrantes || []), 'organizaciones');
        await interaction.editReply({ embeds: [embedBase(COLOR.EXITO).setTitle('✅ Legajo actualizado').setDescription(`\`${data.expediente}\` — **${data.nombre}**\n\n<#${hiloId}>`)] });
        return;
      }
      if (sub === 'eliminar') {
        const m = await buscarRegistro('organizaciones', interaction.options.getString('buscar'));
        if (!m) { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Sin resultados')] }); return; }
        const { count } = await db.from('personas').select('*', { count: 'exact', head: true }).eq('organizacion_id', m.id);
        const aviso = count ? `\n\n⚠️ Tiene **${count}** persona(s) vinculada(s).` : '';
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`DEL_MAF_${m.id}`).setLabel('ELIMINAR').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
          new ButtonBuilder().setCustomId('DEL_CANCELAR').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
        );
        await interaction.editReply({ embeds: [embedBase(COLOR.EXPULSION).setTitle('🗑️ Confirmar eliminación').setDescription(`Vas a eliminar **${m.nombre}** (\`${m.expediente}\`).${aviso}`)], components: [row] });
        return;
      }
    } catch (e) {
      if (e.message === 'AMBIGUO') {
        const l = e.opciones.map(o => `${SEP} \`${o.expediente}\` **${o.nombre}**`).join('\n');
        await interaction.editReply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Búsqueda ambigua').setDescription(l)] }); return;
      }
      try { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Error').setDescription(`\`${e.message}\``)] }); } catch (e2) {}
    }
    return;
  }

  // ==================== /legajo ====================
  if (cmd === 'legajo') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const resolverOrg = async (termino) => {
        if (!termino) return null;
        const o = await buscarRegistro('organizaciones', termino);
        if (!o) throw new Error(`No existe organización que coincida con "${termino}".`);
        return o;
      };
      if (sub === 'crear') {
        const nombre = interaction.options.getString('nombre').trim();
        const dup = await db.from('personas').select('expediente,nombre').ilike('nombre', nombre).maybeSingle();
        if (dup.data) { await interaction.editReply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Ya existe').setDescription(`\`${dup.data.expediente}\``)] }); return; }
        const org = await resolverOrg(interaction.options.getString('organizacion'));
        const expediente = await nuevoExpediente('LEG');
        const { data, error } = await db.from('personas').insert({
          expediente, nombre,
          alias: interaction.options.getString('alias'), organizacion_id: org?.id || null,
          rango: interaction.options.getString('rango'), estado: interaction.options.getString('estado') || 'libre',
          notas: interaction.options.getString('notas'), creado_por: interaction.user.id
        }).select().single();
        if (error) throw new Error(error.message);
        const hiloId = await sincronizarPost(FORO_PERSONAS, data, embedPersona(data, org), 'personas');
        if (org) {
          const { data: ints } = await db.from('personas').select('*').eq('organizacion_id', org.id).order('nombre');
          await sincronizarPost(FORO_MAFIAS, org, embedMafia(org, ints || []), 'organizaciones').catch(() => {});
        }
        await interaction.editReply({ embeds: [embedBase(COLOR.EXITO).setTitle('✅ Legajo abierto').setDescription(`**${nombre}** — \`${expediente}\`\n\n<#${hiloId}>`)] });
        return;
      }
      if (sub === 'info') {
        const p = await buscarRegistro('personas', interaction.options.getString('buscar'));
        if (!p) { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Sin resultados')] }); return; }
        let org = null;
        if (p.organizacion_id) { const r = await db.from('organizaciones').select('*').eq('id', p.organizacion_id).maybeSingle(); org = r.data; }
        await interaction.editReply({ embeds: [embedPersona(p, org)] });
        return;
      }
      if (sub === 'actualizar') {
        const p = await buscarRegistro('personas', interaction.options.getString('buscar'));
        if (!p) { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Sin resultados')] }); return; }
        const cambios = { actualizado_en: new Date().toISOString() };
        for (const f of ['alias', 'rango', 'estado', 'notas']) { const v = interaction.options.getString(f); if (v !== null) cambios[f] = v; }
        const sumar = interaction.options.getString('sumar_nota');
        if (sumar) cambios.notas = (p.notas ? p.notas + '\n' : '') + `• ${sumar}`;
        const orgTermino = interaction.options.getString('organizacion');
        let orgNueva = null;
        if (orgTermino) { orgNueva = await resolverOrg(orgTermino); cambios.organizacion_id = orgNueva.id; }
        if (Object.keys(cambios).length === 1) { await interaction.editReply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Nada que actualizar')] }); return; }
        const orgAnteriorId = p.organizacion_id;
        const { data, error } = await db.from('personas').update(cambios).eq('id', p.id).select().single();
        if (error) throw new Error(error.message);
        let org = orgNueva;
        if (!org && data.organizacion_id) { const r = await db.from('organizaciones').select('*').eq('id', data.organizacion_id).maybeSingle(); org = r.data; }
        const hiloId = await sincronizarPost(FORO_PERSONAS, data, embedPersona(data, org), 'personas');
        const afectadas = [...new Set([data.organizacion_id, orgAnteriorId].filter(Boolean))];
        for (const oid of afectadas) {
          const r = await db.from('organizaciones').select('*').eq('id', oid).maybeSingle();
          if (!r.data) continue;
          const { data: ints } = await db.from('personas').select('*').eq('organizacion_id', oid).order('nombre');
          await sincronizarPost(FORO_MAFIAS, r.data, embedMafia(r.data, ints || []), 'organizaciones').catch(() => {});
        }
        await interaction.editReply({ embeds: [embedBase(COLOR.EXITO).setTitle('✅ Legajo actualizado').setDescription(`\`${data.expediente}\` — **${data.nombre}**\n\n<#${hiloId}>`)] });
        return;
      }
      if (sub === 'eliminar') {
        const p = await buscarRegistro('personas', interaction.options.getString('buscar'));
        if (!p) { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Sin resultados')] }); return; }
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`DEL_LEG_${p.id}`).setLabel('ELIMINAR').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
          new ButtonBuilder().setCustomId('DEL_CANCELAR').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
        );
        await interaction.editReply({ embeds: [embedBase(COLOR.EXPULSION).setTitle('🗑️ Confirmar eliminación').setDescription(`Vas a eliminar **${p.nombre}** (\`${p.expediente}\`).`)], components: [row] });
        return;
      }
    } catch (e) {
      if (e.message === 'AMBIGUO') {
        const l = e.opciones.map(o => `${SEP} \`${o.expediente}\` **${o.nombre}**`).join('\n');
        await interaction.editReply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Búsqueda ambigua').setDescription(l)] }); return;
      }
      try { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Error').setDescription(`\`${e.message}\``)] }); } catch (e2) {}
    }
    return;
  }

  // ==================== /normativas ====================
  // ==================== /procedimiento ====================
  if (cmd === 'procedimiento') {
    await interaction.deferReply({ ephemeral: true });

    const valor = interaction.options.getString('nombre');
    const proc = PROCEDIMIENTOS.find(p => p.valor === valor);
    if (!proc) {
      await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Procedimiento inexistente')] });
      return;
    }

    const video = interaction.options.getAttachment('video');
    const videoUrl = interaction.options.getString('video_url');

    let desc =
      `${proc.resumen}\n\n${DIV}\n` +
      `## ◾ MODO DE USO\n\n` +
      `${SEP} Copiar el bloque publicado en el hilo mediante el botón de copiado\n` +
      `${SEP} Conservar la línea correspondiente al paso en curso y eliminar el resto del texto\n` +
      `${SEP} Enviar la línea y repetir con cada paso, respetando el orden establecido\n\n` +
      `-# El texto permanece en el portapapeles durante toda la interpretación: no es necesario volver a este canal.`;

    if (proc.aclaraciones && proc.aclaraciones.length > 0) {
      desc += `\n\n${DIV}\n## ◾ CONSIDERACIONES\n\n` + proc.aclaraciones.map(a => `${SEP} ${a}`).join('\n');
    }

    desc += `\n\n${DIV}\n## ◾ CARÁCTER ORIENTATIVO\n\n` + NOTA_ORIENTATIVA.split('\n').map(l => `${SEP} ${l}`).join('\n');

    if (videoUrl && /^https?:\/\//i.test(videoUrl)) {
      desc += `\n\n${DIV}\n## ◾ MATERIAL AUDIOVISUAL\n\n${SEP} [Ver el video del procedimiento](${videoUrl})`;
    }

    const embedProc = new EmbedBuilder()
      .setAuthor({ name: 'G.E.O.F • Grupo Especial de Operaciones Federales' })
      .setTitle(`📘 ${proc.nombre.toUpperCase()}`)
      .setColor(COLOR.BASE)
      .setDescription(desc)
      .setFooter({ text: 'G.E.O.F • Procedimientos de interpretación' })
      .setTimestamp();

    try {
      let mensaje;
      let avisoVideo = '';

      try {
        mensaje = await interaction.channel.send({
          embeds: [embedProc],
          files: video ? [video.url] : [],
          allowedMentions: { parse: [] }
        });
      } catch (e) {
        const esTamano = e.status === 413 || /entity too large|Request entity too large|40005/i.test(e.message || '');
        if (video && esTamano) {
          // El video supera el límite de subida: se publica igual el procedimiento, sin el archivo.
          const peso = (video.size / 1048576).toFixed(1);
          mensaje = await interaction.channel.send({ embeds: [embedProc], allowedMentions: { parse: [] } });
          avisoVideo = `\n\n⚠️ El video pesa **${peso} MB** y supera el límite de subida del servidor. El procedimiento se publicó sin el archivo: subilo aparte al hilo, o volvé a ejecutar el comando usando la opción \`video_url\` con un link.`;
        } else {
          throw e;
        }
      }

      const trozos = trozosProcedimiento(proc.lineas);
      let destino = interaction.channel;
      let enHilo = false;

      try {
        destino = await mensaje.startThread({
          name: proc.nombre.slice(0, 90),
          autoArchiveDuration: ARCHIVO_HILO
        });
        enHilo = true;
      } catch (e) {
        console.warn('[PROCEDIMIENTO] No se pudo crear el hilo:', e.message);
      }

      // El bloque va solo, sin texto alrededor: así el copiado desde celular no arrastra nada más.
      for (const trozo of trozos) {
        await destino.send({ content: '```\n' + trozo.join('\n') + '\n```', allowedMentions: { parse: [] } });
      }

      await interaction.editReply({
        embeds: [embedBase(avisoVideo ? COLOR.ADVERTENCIA : COLOR.EXITO)
          .setTitle(avisoVideo ? '⚠️ Procedimiento publicado sin el video' : '✅ Procedimiento publicado')
          .setDescription((enHilo
            ? `**${proc.nombre}** publicado. El bloque copiable quedó en el hilo del mensaje.`
            : `**${proc.nombre}** publicado. No se pudo abrir el hilo, así que el bloque quedó en este mismo canal.`) + avisoVideo)]
      });
    } catch (e) {
      try { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Error').setDescription(`\`${e.message}\``)] }); } catch (e2) {}
    }
    return;
  }

  if (cmd === 'normativas') {
    await interaction.deferReply({ ephemeral: true });
    const rol = (id, fallback) => (id && /^\d{17,20}$/.test(id)) ? `<@&${id}>` : `**${fallback}**`;
    const embedUno = new EmbedBuilder()
      .setAuthor({ name: 'G.E.O.F • Grupo Especial de Operaciones Federales' })
      .setTitle('📕 NORMATIVA INTERNA')
      .setColor(COLOR.BASE)
      .setDescription(
        `-# Estar en el G.E.O.F es un privilegio, no un derecho adquirido.\n\n${DIV}\n` +
        `## ◾ INGRESO\n\n` +
        `${SEP} Rango mínimo **Sargento** en la P.F.A.\n${SEP} **Conducta intachable. Con sanciones vigentes no se ingresa ni se permanece**\n${SEP} Micrófono funcional y disponibilidad para operativos\n${SEP} Aprobar la evaluación de ingreso\n\n` +
        `**Evaluación**\n${SEP} Cuatro instancias, plazo de **15 minutos**\n${SEP} Se evalúa criterio, no extensión\n${SEP} Copiar respuestas implica **rechazo automático**\n${SEP} Rechazada la postulación, espera de **24 horas**\n\n` +
        `**Ascensos**\n${SEP} Se ponderan actividad, desempeño, disciplina y conducción\n${SEP} Los resuelve el alto mando\n-# El ascenso no se solicita ni se reclama.\n\n` +
        `**Inteligencia**\n${SEP} **No se postula** — la designación es facultad de la cúpula\n${SEP} Sus funciones son compatibles con la rama operativa\n\n${DIV}\n` +
        `## ◾ OPERACIÓN\n\n` +
        `**Cadena de mando**\n${SEP} La autoridad en el terreno recae en el **Jefe** presente\n${SEP} Las órdenes se ejecutan sin dilación\n${SEP} Toda objeción se eleva **finalizado** el operativo, nunca durante\n\n` +
        `**Uso de la fuerza**\n${SEP} La negociación es **obligatoria** ante rehenes\n${SEP} El ${rol(ROL_NEGOCIADOR, 'Negociador')} es el único habilitado para dialogar\n${SEP} Nadie interfiere una negociación en curso\n${SEP} La fuerza es el último recurso\n\n` +
        `⚠️ **El ${rol(ROL_FRANCOTIRADOR, 'Francotirador')} no efectúa disparo sin autorización expresa del Jefe. Sin excepción.**`
      )
      .setFooter({ text: 'G.E.O.F • I — Ingreso y operación' });

    const embedDos = new EmbedBuilder()
      .setTitle('📙 INTELIGENCIA Y BAJAS')
      .setColor(COLOR.RETIRO)
      .setDescription(
        `## ◾ INTELIGENCIA\n\n` +
        `${SEP} La información de la rama **no sale de la rama**\n` +
        `${SEP} El ${rol(ROL_INFILTRADO, 'Infiltrado')} opera bajo identidad encubierta y **queda excluido de operativos contra la organización que infiltra**\n` +
        `${SEP} Comprometida la identidad, corresponde extracción inmediata\n\n${DIV}\n` +
        `## ◾ BAJAS\n\n` +
        `**🚫 Expulsión** — Baja por sanción. Remoción total de roles.\n` +
        `**📤 Retiro** — Baja voluntaria. Se agradece el servicio prestado.\n\n-# Cómo se sale queda asentado.`
      )
      .setFooter({ text: 'G.E.O.F • II — Inteligencia y bajas' })
      .setTimestamp();

    try {
      await interaction.channel.send({ embeds: [embedUno, embedDos], allowedMentions: { parse: [] } });
      await interaction.editReply({ embeds: [embedBase(COLOR.EXITO).setTitle('✅ Normativa publicada')] });
    } catch (e) {
      try { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Error').setDescription(`\`${e.message}\``)] }); } catch (e2) {}
    }
    return;
  }

  // ==================== /jerarquia ====================
  if (cmd === 'jerarquia') {
    await interaction.deferReply({ ephemeral: true });
    const rol = (id, fallback) => (id && /^\d{17,20}$/.test(id)) ? `<@&${id}>` : `**${fallback}**`;

    const embedOps = new EmbedBuilder()
      .setAuthor({ name: 'G.E.O.F • Grupo Especial de Operaciones Federales' })
      .setTitle('⚔️ ESTRUCTURA DE MANDO')
      .setColor(COLOR.OPERATIVO)
      .setDescription(
        `Responsable de la intervención táctica: rescate de rehenes, ingresos de alto riesgo, aseguramiento de objetivos y resolución de situaciones críticas.\n\n` +
        '```\n' +
        '              DUEÑO/A\n' +
        '                 |\n' +
        '             DIRECTOR/A\n' +
        '                 |\n' +
        '             COMANDANTE\n' +
        '                 |\n' +
        '          JEFE / SUB JEFE\n' +
        '                 |\n' +
        '  NEGOCIADOR · FRANCOTIRADOR · TÁCTICO\n' +
        '                 |\n' +
        '               MIEMBRO\n' +
        '```\n' +
        `## ⬛ CONDUCCIÓN\n\n` +
        `👑 ${rol(ROL_DUENO_GEOF, 'Dueño/a G.E.O.F')}\n` +
        `${SEP} Autoridad máxima de la subdivisión\n${SEP} Establece la normativa, la estructura y sus modificaciones\n${SEP} Resuelve designaciones de alto rango y decisiones críticas\n` +
        `-# Conducción institucional. No interviene en campo.\n\n` +
        `⭐ ${rol(ROL_DIRECTOR_GEOF, 'Director/a G.E.O.F')}\n` +
        `${SEP} Conducción efectiva de ambas ramas\n${SEP} Enlace con el alto mando de la P.F.A.\n${SEP} Autoriza intervenciones de envergadura\n` +
        `-# Máxima autoridad operativa activa.\n\n${DIV}\n` +
        `## ⬛ JEFATURA\n\n` +
        `🎖️ ${rol(ROL_COMANDANTE_GEOF, 'Comandante G.E.O.F')}\n` +
        `${SEP} Nexo entre la Dirección y el mando en campo\n${SEP} Supervisa el desempeño de la Jefatura\n${SEP} Conduce las intervenciones de mayor complejidad\n` +
        `-# Traduce la decisión institucional en orden operativa.\n\n` +
        `🥇 ${rol(ROL_JEFE_GEOF, 'Jefe G.E.O.F')}\n` +
        `${SEP} Comanda la intervención en el terreno\n${SEP} Asigna funciones tácticas según la situación\n${SEP} Resuelve en tiempo real y responde por el resultado\n` +
        `-# La autoridad en el terreno es indiscutible.\n\n` +
        `🥈 ${rol(ROL_SUBJEFE_GEOF, 'Sub Jefe G.E.O.F')}\n` +
        `${SEP} Segundo al mando de la subdivisión\n${SEP} Asume la conducción en ausencia del Jefe\n${SEP} Apoya la coordinación y el control del personal\n\n${DIV}\n` +
        `## ⬛ FUNCIONES TÁCTICAS\n\n` +
        `🗣️ ${rol(ROL_NEGOCIADOR, 'Negociador')}\n` +
        `${SEP} Único habilitado para dialogar con el agresor\n${SEP} Administra rehenes, plazos y exigencias\n${SEP} Informa al mando la evolución de la crisis\n` +
        `-# Su objetivo es resolver sin intervención armada.\n\n` +
        `🎯 ${rol(ROL_FRANCOTIRADOR, 'Francotirador')}\n` +
        `${SEP} Cobertura y observación desde posición elevada\n${SEP} Aporta información del objetivo al mando\n` +
        `⚠️ No efectúa disparo sin autorización expresa.\n\n` +
        `⚔️ ${rol(ROL_TACTICO, 'Táctico')}\n` +
        `${SEP} Elemento de asalto. Ejecuta ingresos y aseguramiento\n${SEP} Protege al Negociador durante la intervención\n${SEP} Cumple la orden del mando sin dilación\n\n${DIV}\n` +
        `## ⬛ AGENTES\n\n` +
        `🔸 ${rol(ROL_MIEMBRO_GEOF, 'Miembro G.E.O.F')}\n` +
        `${SEP} Agente operativo de la subdivisión\n${SEP} Ingresa por postulación con examen\n${SEP} Accede a las funciones tácticas según desempeño`
      )
      .setFooter({ text: 'G.E.O.F • Estructura de Mando' });

    const embedIntel = new EmbedBuilder()
      .setTitle('🕵️ RAMA DE INTELIGENCIA')
      .setColor(COLOR.RETIRO)
      .setDescription(
        `Trabajo previo y posterior a la intervención: infiltración, análisis y obtención de información.\n\n` +
        '```\n' +
        '             DIRECTOR/A\n' +
        '                 |\n' +
        '        JEFE DE INTELIGENCIA\n' +
        '                 |\n' +
        '  INFILTRADO · ANALISTA · INTERROGADOR\n' +
        '```\n' +
        `## ⬛ CONDUCCIÓN\n\n` +
        `🕶️ ${rol(ROL_JEFE_INTEL, 'Jefe de Inteligencia')}\n` +
        `${SEP} Conduce la rama y administra los casos abiertos\n${SEP} Reporta directamente al Director, no al mando operativo\n${SEP} Único que conoce la asignación de cada infiltrado\n` +
        `-# La rama corre en paralelo a Operaciones, no por debajo.\n\n${DIV}\n` +
        `## ⬛ FUNCIONES\n\n` +
        `🎭 ${rol(ROL_INFILTRADO, 'Infiltrado')}\n` +
        `${SEP} Opera bajo identidad encubierta dentro de la organización asignada\n${SEP} Contacto restringido a su conducción\n` +
        `⚠️ Excluido de todo operativo contra la organización que infiltra.\n\n` +
        `📊 ${rol(ROL_ANALISTA, 'Analista')}\n` +
        `${SEP} Elabora y actualiza los legajos de caso\n${SEP} Establece estructura, vínculos y movimientos de cada organización\n` +
        `-# Convierte lo que llega del infiltrado en información accionable.\n\n` +
        `🔍 ${rol(ROL_INTERROGADOR, 'Interrogador')}\n` +
        `${SEP} Obtiene información con posterioridad a la detención\n${SEP} Coteja lo declarado con el legajo del caso\n` +
        `-# El Negociador interviene durante la crisis; el Interrogador, una vez asegurado el detenido.\n\n${DIV}\n` +
        `## ⬛ PROTOCOLO DEL INFILTRADO\n\n` +
        `${SEP} **Requerimiento menor** (traslado, sustracción, encubrimiento) — Resuelve por decisión propia\n` +
        `${SEP} **Requerimiento mayor** (violencia o acción irreversible) — Agota previamente toda vía de simulación: errar el disparo, sabotear la acción, justificar la negativa\n` +
        `${SEP} **Imposibilidad de simular** — Solicita autorización a su conducción. Existe una línea que no se cruza bajo ninguna circunstancia\n` +
        `${SEP} **Cruce de la línea o pérdida de cobertura** — Extracción inmediata y actuación de las consecuencias que correspondan\n\n${DIV}\n` +
        `## 🤝 ARTICULACIÓN CON OPERACIONES\n\n` +
        `${SEP} Inteligencia aporta el objetivo, la estructura y el momento\n${SEP} Operaciones ejecuta la intervención\n${SEP} El infiltrado permanece fuera de toda actuación contra su organización\n` +
        `-# Inteligencia trabaja antes y después. Operaciones, durante.\n\n${DIV}\n` +
        `## 📌 INCORPORACIÓN\n\n` +
        `${SEP} **No se accede por postulación** — designación por cúpula\n${SEP} Compatible con la rama operativa`
      )
      .setFooter({ text: 'G.E.O.F • Rama de Inteligencia' })
      .setTimestamp();

    try {
      await interaction.channel.send({ embeds: [embedOps, embedIntel], allowedMentions: { parse: [] } });
      await interaction.editReply({ embeds: [embedBase(COLOR.EXITO).setTitle('✅ Jerarquía publicada')] });
    } catch (e) {
      try { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Error').setDescription(`\`${e.message}\``)] }); } catch (e2) {}
    }
    return;
  }

  // ==================== /geof panel-postulaciones ====================
  if (sub === 'panel-postulaciones') {
    if (interaction.channelId !== CANAL_PANEL) {
      await interaction.reply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Canal incorrecto').setDescription(`Usá este comando en <#${CANAL_PANEL}>.`)], ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const embedPanel = new EmbedBuilder()
      .setAuthor({ name: 'G.E.O.F • Grupo Especial de Operaciones Federales' })
      .setTitle('🎯 CONVOCATORIA ABIERTA')
      .setDescription(
        `Buscamos oficiales de la PFA con **criterio**, **mentalidad táctica** y disposición para operativos de alta complejidad.\n\n${DIV}\n\n` +
        `**◾ Requisitos**\n${SEP} Rango PFA activo (Sargento o superior)\n${SEP} Micrófono funcional\n${SEP} Disponibilidad para operativos\n${SEP} Criterio bajo presión\n\n` +
        `**◾ Proceso de admisión**\n${SEP} **4 formularios** secuenciales\n${SEP} Tiempo límite: **15 minutos**\n${SEP} Cooldown post-rechazo: **24 horas**\n\n${DIV}\n\n` +
        `**⚠️ Advertencia**\n> Las respuestas se evalúan por **calidad**, no cantidad.\n> Copiar respuestas resulta en **rechazo automático**.`
      )
      .setColor(COLOR.BASE)
      .setFooter({ text: 'G.E.O.F • Postulaciones vía Sistema Interno' });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('POSTULAR_INICIAR').setLabel('POSTULARSE').setStyle(ButtonStyle.Primary).setEmoji('🎯')
    );
    try {
      const canalPanel = await client.channels.fetch(CANAL_PANEL);
      await canalPanel.send({ embeds: [embedPanel], components: [row] });
      await interaction.editReply({ embeds: [embedBase(COLOR.EXITO).setTitle('✅ Panel publicado').setDescription(`El panel fue publicado en <#${CANAL_PANEL}>.`)] });
    } catch (e) {
      try { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Error al publicar').setDescription(`\`${e.message}\``)] }); } catch (e2) {}
    }
    return;
  }

  // ==================== /geof nuevo ====================
  if (sub === 'nuevo') {
    if (interaction.channelId !== CANAL_UPDATES) {
      await interaction.reply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Canal incorrecto').setDescription(`Usá este comando en <#${CANAL_UPDATES}>.`)], ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const usuario = interaction.options.getUser('usuario');
    try {
      const miembro = await interaction.guild.members.fetch(usuario.id);
      for (const r of [ROL_GEOF, ROL_TACTICO]) {
        if (!miembro.roles.cache.has(r)) await miembro.roles.add(r, 'Ingreso manual G.E.O.F');
      }
      const canalUp = await client.channels.fetch(CANAL_UPDATES);
      const embed = new EmbedBuilder()
        .setAuthor({ name: 'G.E.O.F • Registro de Ingresos' })
        .setTitle('🎯 NUEVO INGRESO CONFIRMADO')
        .setDescription(`<@${usuario.id}> ha sido incorporado oficialmente al **G.E.O.F**.\n${DIV}`)
        .setColor(COLOR.APROBADO)
        .setThumbnail(usuario.displayAvatarURL())
        .addFields(
          { name: '👮 Ingresado por', value: revisor, inline: true },
          { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'G.E.O.F • Sistema de Ingresos' });
      await canalUp.send({ content: `<@${usuario.id}>`, embeds: [embed] });
      await interaction.editReply({ embeds: [embedBase(COLOR.EXITO).setTitle('✅ Ingreso registrado').setDescription(`**${miembro.displayName}** fue incorporado al G.E.O.F.`)] });
    } catch (err) {
      try { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Error').setDescription(`\`${err.message}\``)] }); } catch (e2) {}
    }
    return;
  }

  // ==================== /geof operativo ====================
  if (sub === 'operativo') {
    const modal = new ModalBuilder().setCustomId('modal_operativo').setTitle('Nuevo Operativo — G.E.O.F');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('op_tipo').setLabel('Tipo de operativo').setStyle(TextInputStyle.Short).setPlaceholder('Toma de rehenes, Ingreso táctico, Perímetro').setRequired(true).setMaxLength(60)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('op_hora').setLabel('Hora del operativo').setStyle(TextInputStyle.Short).setPlaceholder('21:00').setRequired(true).setMaxLength(20)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('op_lugar').setLabel('Zona / Ubicación').setStyle(TextInputStyle.Short).setPlaceholder('Banco Central, Zona Norte').setRequired(true).setMaxLength(80)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('op_descripcion').setLabel('Objetivo del operativo').setStyle(TextInputStyle.Paragraph).setPlaceholder('Detallá objetivo, táctica y lo esperado de cada uno.').setRequired(true).setMaxLength(500)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('op_requisitos').setLabel('Requisitos / Participantes').setStyle(TextInputStyle.Short).setPlaceholder('Toda la unidad, mínimo 4 agentes').setRequired(false).setMaxLength(100))
    );
    await interaction.showModal(modal);
    return;
  }

  // ==================== /geof expulsar ====================
  if (sub === 'expulsar') {
    await interaction.deferReply({ ephemeral: true });
    const usuario = interaction.options.getUser('usuario');
    const motivo  = interaction.options.getString('motivo');
    try {
      const miembro = await interaction.guild.members.fetch(usuario.id);
      if (miembro.roles.cache.has(ROL_DUENO_GEOF)) {
        await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Operación bloqueada').setDescription('No podés expulsar al **Dueño** del G.E.O.F.')] });
        return;
      }
      for (const rid of TODOS_ROLES_GEOF) {
        if (miembro.roles.cache.has(rid) && rid !== ROL_DUENO_GEOF) await miembro.roles.remove(rid).catch(() => {});
      }
      const canalUp = await client.channels.fetch(CANAL_UPDATES);
      const embed = new EmbedBuilder()
        .setAuthor({ name: 'G.E.O.F • Sistema de Bajas' })
        .setTitle('🚫 EXPULSIÓN CONFIRMADA')
        .setDescription(`<@${usuario.id}> ha sido expulsado del **G.E.O.F**.\n${DIV}`)
        .setColor(COLOR.EXPULSION)
        .setThumbnail(usuario.displayAvatarURL())
        .addFields(
          { name: '📋 Motivo', value: `> ${trunc(motivo, 800)}`, inline: false },
          { name: '👮 Ejecutado por', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'G.E.O.F • Sistema de Bajas' });
      await canalUp.send({ embeds: [embed] });
      await interaction.editReply({ embeds: [embedBase(COLOR.EXITO).setTitle('✅ Expulsión ejecutada').setDescription(`**${miembro.displayName}** fue expulsado.`)] });
    } catch (err) {
      try { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Error').setDescription(`\`${err.message}\``)] }); } catch (e2) {}
    }
    return;
  }

  // ==================== /geof retiro ====================
  if (sub === 'retiro') {
    if (interaction.channelId !== CANAL_UPDATES) {
      await interaction.reply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Canal incorrecto').setDescription(`Usá este comando en <#${CANAL_UPDATES}>.`)], ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const usuario = interaction.options.getUser('usuario');
    const motivo  = interaction.options.getString('motivo');
    try {
      const miembro = await interaction.guild.members.fetch(usuario.id);
      if (miembro.roles.cache.has(ROL_DUENO_GEOF)) {
        await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Operación bloqueada')] });
        return;
      }
      const teniaRoles = TODOS_ROLES_GEOF.some(rid => miembro.roles.cache.has(rid));
      if (!teniaRoles) {
        await interaction.editReply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ No es miembro')] });
        return;
      }
      for (const rid of TODOS_ROLES_GEOF) {
        if (miembro.roles.cache.has(rid) && rid !== ROL_DUENO_GEOF) await miembro.roles.remove(rid).catch(() => {});
      }
      const canalUp = await client.channels.fetch(CANAL_UPDATES);
      const campos = [];
      if (motivo && motivo.trim()) campos.push({ name: '📋 Motivo', value: `> ${trunc(motivo, 800)}`, inline: false });
      campos.push(
        { name: '👮 Registrado por', value: `<@${interaction.user.id}>`, inline: true },
        { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      );
      const embed = new EmbedBuilder()
        .setAuthor({ name: 'G.E.O.F • Sistema de Bajas' })
        .setTitle('📤 RETIRO VOLUNTARIO')
        .setDescription(`<@${usuario.id}> se ha retirado del **G.E.O.F**.\n${DIV}`)
        .setColor(COLOR.RETIRO)
        .setThumbnail(usuario.displayAvatarURL())
        .addFields(...campos)
        .setTimestamp()
        .setFooter({ text: 'G.E.O.F • Sistema de Bajas' });
      await canalUp.send({ embeds: [embed] });
      await interaction.editReply({ embeds: [embedBase(COLOR.EXITO).setTitle('✅ Retiro registrado').setDescription(`Se registró el retiro de **${miembro.displayName}**.`)] });
    } catch (err) {
      try { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Error').setDescription(`\`${err.message}\``)] }); } catch (e2) {}
    }
    return;
  }
});

// ==================== HEALTHCHECK + WATCHDOG ====================
const http = require('http');
const HEALTH_PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  const ok = client.isReady();
  res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: ok ? 'OK' : 'DISCONNECTED', uptime: Math.floor(process.uptime()) }));
}).listen(HEALTH_PORT, () => console.log('[HEALTH] Servidor HTTP en puerto ' + HEALTH_PORT));

let desconectadoDesde = null;
setInterval(() => {
  if (process.uptime() * 1000 < 60000) return;
  if (client.isReady()) { desconectadoDesde = null; return; }
  if (desconectadoDesde === null) { desconectadoDesde = Date.now(); return; }
  if (Date.now() - desconectadoDesde > 3 * 60 * 1000) { console.error('[WATCHDOG] Reiniciando.'); process.exit(1); }
}, 30000);

client.on('shardDisconnect', (event, shardId) => console.warn('[DISCORD] Shard ' + shardId + ' desconectado.'));
client.on('shardError', (err) => console.error('[DISCORD] Error:', err.message));

if (!process.env.TOKEN) { console.error('[FATAL] TOKEN no definida.'); process.exit(1); }
client.login(process.env.TOKEN)
  .then(() => console.log('[LOGIN] Login OK.'))
  .catch((err) => console.error('[LOGIN] ERROR:', err.message));
