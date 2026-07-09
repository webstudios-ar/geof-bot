require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

process.on('unhandledRejection', (err) => console.error('[GLOBAL] Unhandled promise rejection:', err));
process.on('uncaughtException', (err) => console.error('[GLOBAL] Uncaught exception:', err));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

// ==================== CONFIGURACIÓN ====================
const GITHUB_REPO       = 'webstudios-ar/geof-bot';

const CANAL_PANEL       = '1523832372062326944';
const CANAL_APROBACION  = '1523833135656210462';
const CANAL_UPDATES     = '1493838384416952392';
const CANAL_OPERATIVOS  = '1460758338387050550';

const ROL_GEOF          = '1384737385551495178';
const ROL_TACTICO       = '1412986446599557170';
const ROL_MIEMBRO_GEOF  = '1474252638832033884';
const ROL_DUENO_GEOF    = '1474513244084371697';

const ROLES_AUTORIZADOS = [
  '1474513244084371697',
  '1459343404155670710',
  '1384748336447361085',
  '1457168018269278402',
  '1412987223086731336'
];

const TODOS_ROLES_GEOF = [
  '1384737385551495178',
  '1412986446599557170',
  '1474252638832033884',
  '1474513244084371697',
  '1459343404155670710',
  '1384748336447361085',
  '1457168018269278402',
  '1412987223086731336'
];

const TIEMPO_MAX_POSTULACION_MS = 15 * 60 * 1000;
const COOLDOWN_POSTULACION_MS   = 24 * 60 * 60 * 1000;

// ==================== PALETA VISUAL ====================
const COLOR = {
  BASE:        0x2C2F33, // negro grafito (panel base, info neutra)
  PENDIENTE:   0xE67E22, // naranja alerta (postulación pendiente)
  APROBADO:    0xD4AC0D, // dorado militar (aprobación, ingreso)
  RECHAZADO:   0xC0392B, // rojo carmesí (rechazo)
  EXPULSION:   0x1C1C1C, // negro puro (expulsión)
  OPERATIVO:   0xE74C3C, // rojo alerta operativa
  EXITO:       0x27AE60, // verde éxito (paso completado)
  ADVERTENCIA: 0xF39C12, // ámbar (aviso)
  INFO:        0x3498DB  // azul acero (info general)
};

const DIV = '━━━━━━━━━━━━━━━━━━━━━━━';
const SEP = '▸';

// ==================== ESTADO ====================
const asistentes = {};
const postulacionesActivas = {};
let postulacionesCooldown = {};
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

async function guardarPostulacionesActivas() {
  const serializable = {};
  for (const [uid, data] of Object.entries(postulacionesActivas)) {
    serializable[uid] = { inicio: data.inicio, expiraTs: data.expiraTs, expediente: data.expediente, datos: data.datos };
  }
  await guardarJson('postulaciones_activas.json', serializable, 'update postulaciones activas');
}

function estaEnCooldown(userId) {
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
    postulacionesCooldown[userId] = Date.now() + COOLDOWN_POSTULACION_MS;
    guardarCooldowns().catch(e => console.error('Save cooldowns error:', e.message));
    try {
      const guild = client.guilds.cache.first();
      if (guild) {
        const m = await guild.members.fetch(userId).catch(() => null);
        if (m) {
          const embed = new EmbedBuilder()
            .setAuthor({ name: 'G.E.O.F • Sistema de Postulaciones' })
            .setTitle('⏱️ Tiempo agotado')
            .setDescription(`Tu expediente **\`${exp}\`** fue cerrado por vencimiento de tiempo.\n\nTeniías **15 minutos** para completar el examen. Podés volver a postularte en **24 horas**.`)
            .setColor(COLOR.RECHAZADO)
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

// ==================== READY ====================
client.once('ready', async () => {
  console.log('Bot conectado: ' + client.user.tag);
  const asist = await cargarJson('asistentes.json');
  if (asist) Object.assign(asistentes, asist);
  console.log('Asistentes cargados:', Object.keys(asistentes).length);
  const cool = await cargarJson('postulaciones_cooldown.json');
  if (cool) postulacionesCooldown = cool;
  console.log('Cooldowns cargados:', Object.keys(postulacionesCooldown).length);
  await cargarPostulacionesActivas();
  botListo = true;
  console.log('[BOT] Todos los datos cargados. Bot listo para recibir comandos.');

  const geofCmd = new SlashCommandBuilder()
    .setName('geof')
    .setDescription('Comandos del Grupo G.E.O.F')
    .addSubcommand(s => s.setName('nuevo').setDescription('[HEAD] Ingresa un nuevo miembro al G.E.O.F')
      .addUserOption(o => o.setName('usuario').setDescription('El usuario a ingresar').setRequired(true)))
    .addSubcommand(s => s.setName('operativo').setDescription('[HEAD] Anuncia un operativo del G.E.O.F'))
    .addSubcommand(s => s.setName('expulsar').setDescription('[HEAD] Expulsa a un miembro del G.E.O.F')
      .addUserOption(o => o.setName('usuario').setDescription('El usuario a expulsar').setRequired(true))
      .addStringOption(o => o.setName('motivo').setDescription('Motivo de la expulsión').setRequired(true)))
    .addSubcommand(s => s.setName('panel-postulaciones').setDescription('[HEAD] Publica el panel de convocatoria'));

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: [geofCmd.toJSON()] });
    console.log('Comandos registrados (viejos borrados).');
  } catch (err) { console.error('Error registrando comandos:', err); }
});

// ==================== INTERACTIONS ====================
client.on('interactionCreate', async (interaction) => {
  const tipo = interaction.isChatInputCommand() ? 'SLASH:' + interaction.commandName + (interaction.options.getSubcommand(false) ? '/' + interaction.options.getSubcommand(false) : '')
    : interaction.isButton() ? 'BUTTON:' + interaction.customId
    : interaction.isModalSubmit() ? 'MODAL:' + interaction.customId : 'OTHER';
  console.log('[INTERACTION] ' + tipo + ' por ' + interaction.user.tag);

  if (!botListo) {
    try {
      if (interaction.isRepliable()) await interaction.reply({ content: '⏳ El bot está iniciando. Intentá en unos segundos.', ephemeral: true });
    } catch (e) { }
    return;
  }

  // ==================== MODAL 1 SUBMIT — DATOS ====================
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
      await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Confirmación inválida').setDescription('Debías escribir **`ACEPTO`** exactamente. Tu expediente fue cerrado — volvé a iniciarlo si querés continuar.')], ephemeral: true });
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
      .setDescription(`Datos personales registrados en tu expediente **\`${postulacionesActivas[uid].expediente}\`**.\n\n${DIV}\n\n**Siguiente paso:** Evaluación Táctica — Parte I\n**Tiempo restante:** ⏳ **${minutos} minutos**`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('POSTULAR_SIG_2').setLabel('Continuar → Táctica I').setStyle(ButtonStyle.Primary).setEmoji('📖')
    );
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    return;
  }

  // ==================== MODAL 2 SUBMIT — TÁCTICA I ====================
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
      .setDescription(`Evaluación Táctica — Parte I registrada.\n\n${DIV}\n\n**Siguiente paso:** Evaluación Táctica — Parte II\n**Tiempo restante:** ⏳ **${minutos} minutos**`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('POSTULAR_SIG_3').setLabel('Continuar → Táctica II').setStyle(ButtonStyle.Primary).setEmoji('🛡️')
    );
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    return;
  }

  // ==================== MODAL 3 SUBMIT — TÁCTICA II + MOTIVACIÓN ====================
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

  // ==================== MODAL 4 SUBMIT — SITUACIÓN + PUBLICAR EXPEDIENTE ====================
  if (interaction.isModalSubmit() && interaction.customId === 'POSTULAR_MODAL_4') {
    const uid = interaction.user.id;
    if (!postulacionesActivas[uid]) {
      await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Expediente inválido').setDescription('Tu postulación ya no está activa.')], ephemeral: true });
      return;
    }
    postulacionesActivas[uid].datos.situacion = interaction.fields.getTextInputValue('m4_situacion');
    const d = postulacionesActivas[uid].datos;
    const exp = postulacionesActivas[uid].expediente;

    // Embed 1 — encabezado + datos personales + táctica I
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

    // Embed 2 — táctica II + motivación + situación
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

  // ==================== MODAL OPERATIVO SUBMIT ====================
  if (interaction.isModalSubmit() && interaction.customId === 'modal_operativo') {
    const tipo        = interaction.fields.getTextInputValue('op_tipo');
    const hora        = interaction.fields.getTextInputValue('op_hora');
    const lugar       = interaction.fields.getTextInputValue('op_lugar');
    const descripcion = interaction.fields.getTextInputValue('op_descripcion');
    const requisitos  = interaction.fields.getTextInputValue('op_requisitos') || 'Toda la unidad';

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'G.E.O.F • Operaciones Tácticas' })
      .setTitle(`🚨 OPERATIVO — ${tipo.toUpperCase()}`)
      .setDescription(`**${lugar}** • Convocado por <@${interaction.user.id}>\n${DIV}`)
      .setColor(COLOR.OPERATIVO)
      .addFields(
        { name: '🕐 Hora',          value: '```' + hora + '```', inline: true },
        { name: '📍 Zona',          value: '```' + lugar + '```', inline: true },
        { name: '👥 Participantes', value: '```' + requisitos + '```', inline: true },
        { name: '📝 Objetivo', value: `> ${trunc(descripcion, 800)}`, inline: false },
        { name: `${DIV}\n👥 Asistentes confirmados (0)`, value: '_Presioná el botón para anotarte._', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'G.E.O.F • Sistema de Operaciones' });

    const canalOp = await client.channels.fetch(CANAL_OPERATIVOS);
    const rowAnota = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ANOTA_placeholder').setLabel('ME ANOTO').setStyle(ButtonStyle.Success).setEmoji('🎯')
    );
    const msgEnviado = await canalOp.send({ content: '<@&' + ROL_GEOF + '>', embeds: [embed], components: [rowAnota] });
    const rowReal = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ANOTA_' + msgEnviado.id).setLabel('ME ANOTO').setStyle(ButtonStyle.Success).setEmoji('🎯')
    );
    await msgEnviado.edit({ components: [rowReal] });
    asistentes[msgEnviado.id] = [];

    await interaction.reply({ embeds: [embedBase(COLOR.EXITO).setTitle('✅ Operativo publicado').setDescription(`El operativo fue publicado en <#${CANAL_OPERATIVOS}>.`)], ephemeral: true });
    return;
  }

  // ==================== BOTONES ====================
  if (interaction.isButton()) {
    const id = interaction.customId;

    // POSTULAR — inicia expediente
    if (id === 'POSTULAR_INICIAR') {
      const uid = interaction.user.id;
      const cooldownHasta = estaEnCooldown(uid);
      if (cooldownHasta) {
        const embed = embedBase(COLOR.ADVERTENCIA)
          .setAuthor({ name: 'G.E.O.F • Postulación Bloqueada' })
          .setTitle('⏳ Cooldown activo')
          .setDescription(`Ya te postulaste recientemente.\nPodés volver a intentar <t:${Math.floor(cooldownHasta / 1000)}:R>.`);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      if (postulacionesActivas[uid]) {
        const minutos = Math.max(0, Math.ceil((postulacionesActivas[uid].expiraTs - Date.now()) / 60000));
        const embed = embedBase(COLOR.ADVERTENCIA)
          .setAuthor({ name: 'G.E.O.F • Expediente en Curso' })
          .setTitle('📋 Ya tenés una postulación activa')
          .setDescription(`Expediente **\`${postulacionesActivas[uid].expediente}\`**\nTiempo restante: **${minutos} minutos**\n\n${DIV}\n\nBuscá en tus mensajes el último formulario del bot y continuá desde ahí.`);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      if (interaction.member.roles.cache.has(ROL_GEOF) || interaction.member.roles.cache.has(ROL_TACTICO) || interaction.member.roles.cache.has(ROL_MIEMBRO_GEOF)) {
        const embed = embedBase(COLOR.RECHAZADO)
          .setAuthor({ name: 'G.E.O.F • Postulación Rechazada' })
          .setTitle('❌ Ya sos parte del G.E.O.F')
          .setDescription('Los oficiales activos del G.E.O.F no pueden volver a postularse.');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
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

    // POSTULAR_SIG — botones de continuar entre pasos
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

    // ANOTA_ — anotarse a operativo
    if (id.startsWith('ANOTA_')) {
      const msgId = id.replace('ANOTA_', '');
      if (!asistentes[msgId]) asistentes[msgId] = [];
      if (asistentes[msgId].includes(interaction.user.id)) {
        await interaction.reply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Ya estás anotado').setDescription('Ya confirmaste asistencia a este operativo.')], ephemeral: true });
        return;
      }
      asistentes[msgId].push(interaction.user.id);
      guardarAsistentes().catch(e => console.error(e));
      const lista = asistentes[msgId].map(u => `${SEP} <@${u}>`).join('\n');
      const msgOriginal = interaction.message;
      const embedActualizado = EmbedBuilder.from(msgOriginal.embeds[0]).setFields(
        ...msgOriginal.embeds[0].fields.filter(f => !f.name.includes('Asistentes confirmados')),
        { name: `${DIV}\n👥 Asistentes confirmados (${asistentes[msgId].length})`, value: lista, inline: false }
      );
      await interaction.update({ embeds: [embedActualizado] });
      return;
    }

    // APROBAR / RECHAZAR
    if (id.startsWith('ap_') || id.startsWith('re_')) {
      const tieneRol = ROLES_AUTORIZADOS.some(r => interaction.member.roles.cache.has(r));
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
              new ButtonBuilder().setCustomId('done_ap').setLabel(`APROBADO por ${revisor} (sin ID)`).setStyle(ButtonStyle.Success).setDisabled(true).setEmoji('✅'),
              new ButtonBuilder().setCustomId('done_re').setLabel('RECHAZAR').setStyle(ButtonStyle.Danger).setDisabled(true).setEmoji('❌')
            );
            await interaction.editReply({ components: [rowDone] });
            return;
          }
          let miembro;
          try { miembro = await interaction.guild.members.fetch(discordId); }
          catch (e) {
            await interaction.followUp({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Postulante no encontrado').setDescription('No se pudo localizar al usuario en el servidor.')], ephemeral: true });
            return;
          }
          try {
            for (const r of [ROL_GEOF, ROL_TACTICO]) {
              if (!miembro.roles.cache.has(r)) await miembro.roles.add(r, 'Ingreso G.E.O.F por aprobación');
            }
          } catch (e) {
            console.error('Error asignando roles:', e.message);
            await interaction.followUp({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Aprobado con advertencia').setDescription('El postulante fue aprobado pero no se pudo asignar los roles. Verificá la jerarquía del bot.')], ephemeral: true });
            return;
          }

          // Embed de ingreso en updates
          const embedIngreso = new EmbedBuilder()
            .setAuthor({ name: 'G.E.O.F • Registro de Ingresos' })
            .setTitle('🎯 NUEVO INGRESO CONFIRMADO')
            .setDescription(`<@${discordId}> ha sido incorporado oficialmente al **G.E.O.F**.\n${DIV}`)
            .setColor(COLOR.APROBADO)
            .setThumbnail(miembro.displayAvatarURL())
            .addFields(
              { name: '👮 Evaluado por', value: `<@${interaction.user.id}>`, inline: true },
              { name: '📅 Fecha',        value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
              { name: '🔸 Roles otorgados', value: '`GEOF` · `Táctico`', inline: true },
              { name: '\u200B', value: `${DIV}\n> _Bienvenido al Grupo Especial de Operaciones Federales._\n> _Se espera profesionalismo y criterio táctico en cada operativo._`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'G.E.O.F • Sistema de Ingresos' });
          try {
            const canalUp = await client.channels.fetch(CANAL_UPDATES);
            await canalUp.send({ content: `<@${discordId}>`, embeds: [embedIngreso] });
          } catch (e) { console.error('Publicar ingreso:', e.message); }

          // DM al aprobado
          try {
            const embedDM = new EmbedBuilder()
              .setAuthor({ name: 'G.E.O.F • Postulación Aprobada' })
              .setTitle('✅ ¡Fuiste APROBADO en el G.E.O.F!')
              .setDescription(`Felicitaciones. Fuiste incorporado al **Grupo Especial de Operaciones Federales**.\n${DIV}`)
              .setColor(COLOR.APROBADO)
              .addFields(
                { name: '👮 Evaluado por', value: revisor, inline: true },
                { name: '📅 Fecha',        value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: '\u200B', value: `${DIV}\n**Próximos pasos**\n${SEP} Los roles ya fueron asignados a tu cuenta\n${SEP} Presentate en los próximos operativos\n${SEP} Consultá los protocolos con la oficialidad\n${SEP} Se espera profesionalismo en cada operativo`, inline: false }
              )
              .setTimestamp()
              .setFooter({ text: 'G.E.O.F • Kilombo RP' });
            await miembro.send({ embeds: [embedDM] });
          } catch (e) { /* DM cerrado */ }

          const rowDone = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('done_ap').setLabel(`APROBADO por ${revisor}`).setStyle(ButtonStyle.Success).setDisabled(true).setEmoji('✅'),
            new ButtonBuilder().setCustomId('done_re').setLabel('RECHAZAR').setStyle(ButtonStyle.Danger).setDisabled(true).setEmoji('❌')
          );

          // Marcar embed original como aprobado (cambiar color + estado)
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
          postulacionesCooldown[discordId] = Date.now() + COOLDOWN_POSTULACION_MS;
          guardarCooldowns().catch(e => console.error(e));
          try {
            const miembro = await interaction.guild.members.fetch(discordId);
            const embedDM = new EmbedBuilder()
              .setAuthor({ name: 'G.E.O.F • Postulación Rechazada' })
              .setTitle('❌ Postulación no aprobada')
              .setDescription(`Tu postulación al **G.E.O.F** no fue aprobada.\n${DIV}`)
              .setColor(COLOR.RECHAZADO)
              .addFields(
                { name: '👮 Evaluado por', value: revisor, inline: true },
                { name: '📅 Fecha',        value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: '⏳ Cooldown',     value: '**24 horas**', inline: true },
                { name: '\u200B', value: `${DIV}\n> Podés volver a postularte una vez transcurrido el período de espera.\n> Te sugerimos revisar los protocolos tácticos y afinar tu criterio antes del próximo intento.`, inline: false }
              )
              .setTimestamp()
              .setFooter({ text: 'G.E.O.F • Kilombo RP' });
            await miembro.send({ embeds: [embedDM] });
          } catch (e) {
            console.error('Error DM rechazo:', e.message);
            await interaction.followUp({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Rechazado, sin notificación').setDescription('Se aplicó el cooldown pero no se pudo enviar DM (el postulante tiene DMs cerrados).')], ephemeral: true });
          }

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
  if (interaction.commandName !== 'geof') return;

  const sub = interaction.options.getSubcommand();
  const tieneRol = ROLES_AUTORIZADOS.some(r => interaction.member.roles.cache.has(r));
  const revisor = interaction.member?.displayName || interaction.user.username;

  if (!tieneRol) {
    await interaction.reply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Sin permisos').setDescription('Este comando está reservado a la oficialidad del G.E.O.F.')], ephemeral: true });
    return;
  }

  // /geof panel-postulaciones
  if (sub === 'panel-postulaciones') {
    if (interaction.channelId !== CANAL_PANEL) {
      await interaction.reply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Canal incorrecto').setDescription(`Este comando solo puede usarse en <#${CANAL_PANEL}>.`)], ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const embedPanel = new EmbedBuilder()
      .setAuthor({ name: 'G.E.O.F • Grupo Especial de Operaciones Federales' })
      .setTitle('🎯 CONVOCATORIA ABIERTA')
      .setDescription(
        `Buscamos oficiales de la PFA con **criterio**, **mentalidad táctica** y disposición para operativos de alta complejidad.\n\n${DIV}\n\n` +
        `**◾ Requisitos**\n${SEP} Rango PFA activo (Sargento o superior)\n${SEP} Micrófono funcional\n${SEP} Disponibilidad para operativos\n${SEP} Conocimiento de protocolos tácticos\n${SEP} Criterio bajo presión\n\n` +
        `**◾ Proceso de admisión**\n${SEP} **4 formularios** secuenciales\n${SEP} Datos personales · Táctica I · Táctica II · Escenario final\n${SEP} Tiempo límite: **15 minutos**\n${SEP} Cooldown post-rechazo: **24 horas**\n\n${DIV}\n\n` +
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
      await interaction.editReply({ embeds: [embedBase(COLOR.EXITO).setTitle('✅ Panel publicado').setDescription(`El panel de convocatoria fue publicado en <#${CANAL_PANEL}>.`)] });
    } catch (e) {
      console.error('Panel:', e);
      try { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Error al publicar').setDescription(`No se pudo publicar el panel.\n\`Error: ${e.message || 'desconocido'}\``)] }); } catch (e2) {}
    }
    return;
  }

  // /geof nuevo
  if (sub === 'nuevo') {
    if (interaction.channelId !== CANAL_UPDATES) {
      await interaction.reply({ embeds: [embedBase(COLOR.ADVERTENCIA).setTitle('⚠️ Canal incorrecto').setDescription(`Este comando solo puede usarse en <#${CANAL_UPDATES}>.`)], ephemeral: true });
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
          { name: '📅 Fecha',         value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          { name: '🔸 Roles otorgados', value: '`GEOF` · `Táctico`', inline: true },
          { name: '\u200B', value: `${DIV}\n> _Bienvenido al Grupo Especial de Operaciones Federales._\n> _Ingreso manual autorizado por la oficialidad._`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'G.E.O.F • Sistema de Ingresos' });
      await canalUp.send({ content: `<@${usuario.id}>`, embeds: [embed] });
      await interaction.editReply({ embeds: [embedBase(COLOR.EXITO).setTitle('✅ Ingreso registrado').setDescription(`**${miembro.displayName}** fue incorporado al G.E.O.F.`)] });
    } catch (err) {
      console.error('/geof nuevo:', err);
      try { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Error al ingresar').setDescription(`No se pudo ingresar al miembro.\n\`${err.message || 'error desconocido'}\``)] }); } catch (e2) {}
    }
    return;
  }

  // /geof operativo
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

  // /geof expulsar
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
        if (miembro.roles.cache.has(rid) && rid !== ROL_DUENO_GEOF) {
          await miembro.roles.remove(rid).catch(() => {});
        }
      }
      const canalUp = await client.channels.fetch(CANAL_UPDATES);
      const embed = new EmbedBuilder()
        .setAuthor({ name: 'G.E.O.F • Sistema de Bajas' })
        .setTitle('🚫 EXPULSIÓN CONFIRMADA')
        .setDescription(`<@${usuario.id}> ha sido separado del **G.E.O.F**.\n${DIV}`)
        .setColor(COLOR.EXPULSION)
        .setThumbnail(usuario.displayAvatarURL())
        .addFields(
          { name: '📋 Motivo',       value: `> ${trunc(motivo, 800)}`, inline: false },
          { name: '👮 Ejecutado por', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📅 Fecha',         value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          { name: '\u200B', value: `${DIV}\n> _Todos los roles G.E.O.F fueron removidos._\n> _Este oficial no forma parte de la unidad._`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'G.E.O.F • Sistema de Bajas' });
      await canalUp.send({ embeds: [embed] });
      await interaction.editReply({ embeds: [embedBase(COLOR.EXITO).setTitle('✅ Expulsión ejecutada').setDescription(`**${miembro.displayName}** fue expulsado del G.E.O.F.`)] });
    } catch (err) {
      console.error('/geof expulsar:', err);
      try { await interaction.editReply({ embeds: [embedBase(COLOR.RECHAZADO).setTitle('❌ Error al expulsar').setDescription(`\`${err.message || 'error desconocido'}\``)] }); } catch (e2) {}
    }
    return;
  }
});

// ==================== HEALTHCHECK + WATCHDOG ====================
const http = require('http');
const HEALTH_PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  if ((req.url || '/') === '/healthcheck' || (req.url || '/') === '/health' || (req.url || '/') === '/') {
    const ok = client.isReady();
    res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: ok ? 'OK' : 'DISCONNECTED', uptime: Math.floor(process.uptime()) }));
  } else { res.writeHead(404); res.end(); }
}).listen(HEALTH_PORT, () => console.log('[HEALTH] Servidor HTTP en puerto ' + HEALTH_PORT));

let desconectadoDesde = null;
setInterval(() => {
  if (process.uptime() * 1000 < 60000) return;
  if (client.isReady()) {
    if (desconectadoDesde !== null) { console.log('[WATCHDOG] Reconectado.'); desconectadoDesde = null; }
    return;
  }
  if (desconectadoDesde === null) { desconectadoDesde = Date.now(); console.warn('[WATCHDOG] Bot desconectado. Tolerancia 3 min.'); return; }
  if (Date.now() - desconectadoDesde > 3 * 60 * 1000) { console.error('[WATCHDOG] Matando proceso para reinicio.'); process.exit(1); }
}, 30000);

client.on('shardDisconnect', (event, shardId) => console.warn('[DISCORD] Shard ' + shardId + ' desconectado. Código: ' + event.code));
client.on('shardError', (err) => console.error('[DISCORD] Error:', err.message));

if (!process.env.TOKEN) { console.error('[FATAL] TOKEN no definida.'); process.exit(1); }
client.login(process.env.TOKEN)
  .then(() => console.log('[LOGIN] Login OK. Esperando ready...'))
  .catch((err) => console.error('[LOGIN] ERROR:', err.message));
