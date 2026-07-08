require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// Manejo global de errores para que un crash no tumbe el proceso
process.on('unhandledRejection', (err) => {
  console.error('[GLOBAL] Unhandled promise rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('[GLOBAL] Uncaught exception:', err);
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

// ==================== CONSTANTES ====================
const GITHUB_REPO       = 'webstudios-ar/geof-bot';

const CANAL_PANEL       = '1523832372062326944';   // panel con botón POSTULARSE
const CANAL_APROBACION  = '1523833135656210462';   // donde llegan postulaciones para HEAD GEOF
const CANAL_UPDATES     = '1493838384416952392';   // ingresos, ascensos, expulsiones
const CANAL_OPERATIVOS  = '1460758338387050550';   // operativos con "Me anoto"

const ROL_GEOF          = '1384737385551495178';   // rol grupal GEOF
const ROL_TACTICO       = '1412986446599557170';   // rol táctico
const ROL_MIEMBRO_GEOF  = '1474252638832033884';   // miembro GEOF
const ROL_DUENO_GEOF    = '1474513244084371697';   // dueño GEOF

// HEAD GEOF: autorizados a aprobar/rechazar postulaciones
const ROLES_AUTORIZADOS = [
  '1474513244084371697', // Dueño GEOF
  '1459343404155670710',
  '1384748336447361085',
  '1457168018269278402',
  '1412987223086731336'
];

// Todos los roles GEOF (usados en /geof expulsar para removerlos)
const TODOS_ROLES_GEOF = [
  '1384737385551495178', // rol GEOF grupal
  '1412986446599557170', // rol táctico
  '1474252638832033884', // miembro GEOF
  '1474513244084371697', // dueño GEOF
  '1459343404155670710',
  '1384748336447361085',
  '1457168018269278402',
  '1412987223086731336'
];

// Anti-copia
const TIEMPO_MAX_POSTULACION_MS = 15 * 60 * 1000;      // 15 minutos para completar
const COOLDOWN_POSTULACION_MS   = 24 * 60 * 60 * 1000; // 24 horas post rechazo/timeout

// Color base para embeds (negro táctico GEOF)
const COLOR_GEOF        = 0x1C1C1C;
const COLOR_GEOF_APROBAR = 0xB8860B;                    // dorado apagado (aprobación)
const COLOR_GEOF_RECHAZAR = 0x8B0000;                   // rojo oscuro (rechazo)
const COLOR_GEOF_ALERTA = 0xCC2222;                     // rojo alerta (operativos)

// ==================== ESTADO EN MEMORIA ====================
const asistentes = {}; // { messageId: [userId, ...] }
// Postulaciones en curso: { userId: { inicio, expiraTs, timeoutId, datos: {...} } }
const postulacionesActivas = {};
// Cooldowns tras rechazo o timeout, persistido: { userId: expiraTs }
let postulacionesCooldown = {};
let botListo = false;

const fecha = () => new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ==================== PERSISTENCIA ====================
async function guardarAsistentes() {
  try {
    const res = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/asistentes.json', {
      headers: { 'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN, 'Accept': 'application/vnd.github+json' }
    });
    const sha = res.status !== 404 ? (await res.json()).sha : null;
    const content = Buffer.from(JSON.stringify(asistentes, null, 2)).toString('base64');
    const body = { message: 'update asistentes', content };
    if (sha) body.sha = sha;
    await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/asistentes.json', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) { console.error('Error guardando asistentes:', err.message); }
}

async function cargarAsistentes() {
  try {
    const res = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/asistentes.json', {
      headers: { 'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN, 'Accept': 'application/vnd.github+json' }
    });
    if (res.status === 404) return;
    const data = await res.json();
    const loaded = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
    Object.assign(asistentes, loaded);
    console.log('Asistentes cargados:', Object.keys(asistentes).length, 'operativos');
  } catch (err) { console.error('Error cargando asistentes:', err.message); }
}

// Cooldowns de postulaciones
async function guardarCooldowns() {
  try {
    const res = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/postulaciones_cooldown.json', {
      headers: { 'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN, 'Accept': 'application/vnd.github+json' }
    });
    const sha = res.status !== 404 ? (await res.json()).sha : null;
    const content = Buffer.from(JSON.stringify(postulacionesCooldown, null, 2)).toString('base64');
    const body = { message: 'update cooldowns', content };
    if (sha) body.sha = sha;
    await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/postulaciones_cooldown.json', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) { console.error('Error guardando cooldowns:', err.message); }
}

async function cargarCooldowns() {
  try {
    const res = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/postulaciones_cooldown.json', {
      headers: { 'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN, 'Accept': 'application/vnd.github+json' }
    });
    if (res.status === 404) return;
    const data = await res.json();
    postulacionesCooldown = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
    console.log('Cooldowns cargados:', Object.keys(postulacionesCooldown).length, 'usuarios');
  } catch (err) { console.error('Error cargando cooldowns:', err.message); }
}

// Verifica si un usuario está en cooldown
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

// Iniciar timeout de 15 min para una postulación
function iniciarTimeoutPostulacion(userId) {
  const p = postulacionesActivas[userId];
  if (!p) return;
  if (p.timeoutId) clearTimeout(p.timeoutId);
  const restanteMs = Math.max(0, p.expiraTs - Date.now());
  p.timeoutId = setTimeout(async () => {
    if (!postulacionesActivas[userId]) return;
    delete postulacionesActivas[userId];
    guardarPostulacionesActivas().catch(e => console.error('Save error:', e.message));
    // Aplicar cooldown de 24hs por no terminar a tiempo
    postulacionesCooldown[userId] = Date.now() + COOLDOWN_POSTULACION_MS;
    guardarCooldowns().catch(e => console.error('Save cooldowns error:', e.message));
    // Intentar avisar por DM
    try {
      const guild = client.guilds.cache.first();
      if (guild) {
        const m = await guild.members.fetch(userId).catch(() => null);
        if (m) {
          await m.send({ content: '⏱️ **Se te venció el tiempo del examen de G.E.O.F.**\n\nTenías 15 minutos para completarlo. Podés volver a intentar en **24 horas**.' }).catch(() => {});
        }
      }
    } catch (e) { /* ignorar */ }
  }, restanteMs);
}

// Persistir postulaciones activas (sin timeoutId porque no es serializable)
async function guardarPostulacionesActivas() {
  try {
    const serializable = {};
    for (const [uid, data] of Object.entries(postulacionesActivas)) {
      serializable[uid] = {
        inicio: data.inicio,
        expiraTs: data.expiraTs,
        datos: data.datos
      };
    }
    const res = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/postulaciones_activas.json', {
      headers: { 'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN, 'Accept': 'application/vnd.github+json' }
    });
    const sha = res.status !== 404 ? (await res.json()).sha : null;
    const content = Buffer.from(JSON.stringify(serializable, null, 2)).toString('base64');
    const body = { message: 'update postulaciones activas', content };
    if (sha) body.sha = sha;
    await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/postulaciones_activas.json', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) { console.error('Error guardando postulaciones activas:', err.message); }
}

async function cargarPostulacionesActivas() {
  try {
    const res = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/postulaciones_activas.json', {
      headers: { 'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN, 'Accept': 'application/vnd.github+json' }
    });
    if (res.status === 404) return;
    const data = await res.json();
    const loaded = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
    const ahora = Date.now();
    for (const [uid, p] of Object.entries(loaded)) {
      if (p.expiraTs > ahora) {
        postulacionesActivas[uid] = {
          inicio: p.inicio,
          expiraTs: p.expiraTs,
          timeoutId: null,
          datos: p.datos || {}
        };
        iniciarTimeoutPostulacion(uid);
      }
    }
    console.log('Postulaciones activas restauradas:', Object.keys(postulacionesActivas).length);
  } catch (err) { console.error('Error cargando postulaciones activas:', err.message); }
}

// ==================== READY ====================
client.once('ready', async () => {
  console.log('Bot conectado: ' + client.user.tag);
  await cargarAsistentes();
  await cargarCooldowns();
  await cargarPostulacionesActivas();
  botListo = true;
  console.log('[BOT] Todos los datos cargados. Bot listo para recibir comandos.');

  // Comando maestro /geof con TODOS los subcomandos
  const geofCmd = new SlashCommandBuilder()
    .setName('geof')
    .setDescription('Comandos del Grupo G.E.O.F')

    .addSubcommand(s => s.setName('nuevo').setDescription('[HEAD] Ingresa un nuevo miembro al G.E.O.F')
      .addUserOption(o => o.setName('usuario').setDescription('El usuario a ingresar').setRequired(true)))

    .addSubcommand(s => s.setName('operativo').setDescription('[HEAD] Anuncia un operativo del G.E.O.F'))

    .addSubcommand(s => s.setName('expulsar').setDescription('[HEAD] Expulsa a un miembro del G.E.O.F')
      .addUserOption(o => o.setName('usuario').setDescription('El usuario a expulsar').setRequired(true))
      .addStringOption(o => o.setName('motivo').setDescription('Motivo de la expulsión').setRequired(true)))

    .addSubcommand(s => s.setName('panel-postulaciones').setDescription('[HEAD] Publica el panel con el botón para postularse'));

  const commands = [geofCmd.toJSON()];

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Comandos registrados.');
  } catch (err) { console.error('Error registrando comandos:', err); }
});

// ==================== INTERACTIONS ====================
client.on('interactionCreate', async (interaction) => {
  // Bloquear interacciones hasta que el bot haya cargado todos los datos
  if (!botListo) {
    try {
      if (interaction.isRepliable()) {
        await interaction.reply({ content: '⏳ El bot todavía está cargando datos. Esperá unos segundos e intentá de nuevo.', ephemeral: true });
      }
    } catch (e) { /* ignorar */ }
    return;
  }

  // ==================== MODALES DE POSTULACIÓN ====================
  if (interaction.isModalSubmit() && interaction.customId === 'POSTULAR_MODAL_1') {
    const uid = interaction.user.id;
    if (!postulacionesActivas[uid]) {
      await interaction.reply({ content: '❌ Tu postulación se venció. Volvé a arrancar desde el panel.', ephemeral: true });
      return;
    }
    const confirm = interaction.fields.getTextInputValue('m1_confirm').trim().toUpperCase();
    if (confirm !== 'ACEPTO') {
      await interaction.reply({ content: '❌ Debés escribir "ACEPTO" exactamente en el último campo. Volvé a arrancar.', ephemeral: true });
      delete postulacionesActivas[uid];
      guardarPostulacionesActivas().catch(e => console.error('Save error:', e.message));
      return;
    }
    postulacionesActivas[uid].datos.nombre     = interaction.fields.getTextInputValue('m1_nombre');
    postulacionesActivas[uid].datos.rango      = interaction.fields.getTextInputValue('m1_rango');
    postulacionesActivas[uid].datos.disp       = interaction.fields.getTextInputValue('m1_disp');
    postulacionesActivas[uid].datos.diferencia = interaction.fields.getTextInputValue('m1_diferencia');
    guardarPostulacionesActivas().catch(e => console.error('Save error:', e.message));

    const restanteMs = postulacionesActivas[uid].expiraTs - Date.now();
    const minutos = Math.max(0, Math.ceil(restanteMs / 60000));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('POSTULAR_SIG_2').setLabel('Continuar (2/4) — Táctica').setStyle(ButtonStyle.Primary)
    );
    await interaction.reply({ content: '✅ Datos guardados. Te quedan **' + minutos + ' minutos**.\n\nClick en **Continuar** para responder las preguntas de conocimiento táctico.', components: [row], ephemeral: true });
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'POSTULAR_MODAL_2') {
    const uid = interaction.user.id;
    if (!postulacionesActivas[uid]) {
      await interaction.reply({ content: '❌ Tu postulación se venció. Volvé a arrancar desde el panel.', ephemeral: true });
      return;
    }
    postulacionesActivas[uid].datos.nvl          = interaction.fields.getTextInputValue('m2_nvl');
    postulacionesActivas[uid].datos.no_amenazar  = interaction.fields.getTextInputValue('m2_no_amenazar');
    postulacionesActivas[uid].datos.rehenes      = interaction.fields.getTextInputValue('m2_rehenes');
    postulacionesActivas[uid].datos.secuestro    = interaction.fields.getTextInputValue('m2_secuestro');
    postulacionesActivas[uid].datos.ingreso      = interaction.fields.getTextInputValue('m2_ingreso');
    guardarPostulacionesActivas().catch(e => console.error('Save error:', e.message));

    const restanteMs = postulacionesActivas[uid].expiraTs - Date.now();
    const minutos = Math.max(0, Math.ceil(restanteMs / 60000));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('POSTULAR_SIG_3').setLabel('Continuar (3/4) — Táctica II').setStyle(ButtonStyle.Primary)
    );
    await interaction.reply({ content: '✅ Táctica parte 1 guardada. Te quedan **' + minutos + ' minutos**.\n\nClick en **Continuar** para la segunda parte táctica y motivación.', components: [row], ephemeral: true });
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'POSTULAR_MODAL_3') {
    const uid = interaction.user.id;
    if (!postulacionesActivas[uid]) {
      await interaction.reply({ content: '❌ Tu postulación se venció. Volvé a arrancar desde el panel.', ephemeral: true });
      return;
    }
    postulacionesActivas[uid].datos.perimetro    = interaction.fields.getTextInputValue('m3_perimetro');
    postulacionesActivas[uid].datos.por_que      = interaction.fields.getTextInputValue('m3_por_que');
    postulacionesActivas[uid].datos.iniciativa   = interaction.fields.getTextInputValue('m3_iniciativa');
    postulacionesActivas[uid].datos.negociador   = interaction.fields.getTextInputValue('m3_negociador');
    guardarPostulacionesActivas().catch(e => console.error('Save error:', e.message));

    const restanteMs = postulacionesActivas[uid].expiraTs - Date.now();
    const minutos = Math.max(0, Math.ceil(restanteMs / 60000));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('POSTULAR_SIG_4').setLabel('Continuar (4/4) — Situación').setStyle(ButtonStyle.Primary)
    );
    await interaction.reply({ content: '✅ Táctica parte 2 guardada. Te quedan **' + minutos + ' minutos**.\n\nÚltimo paso: **situación táctica final**.', components: [row], ephemeral: true });
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'POSTULAR_MODAL_4') {
    const uid = interaction.user.id;
    if (!postulacionesActivas[uid]) {
      await interaction.reply({ content: '❌ Tu postulación se venció. Volvé a arrancar desde el panel.', ephemeral: true });
      return;
    }
    postulacionesActivas[uid].datos.situacion = interaction.fields.getTextInputValue('m4_situacion');

    const d = postulacionesActivas[uid].datos;

    // Helper para valores con default
    const sf = (v, max = 1024) => {
      const s = (v || '_(vacío)_').toString();
      return s.length > max ? s.slice(0, max - 3) + '...' : s;
    };

    // Truncar a 400 chars por campo largo para no pasar el límite de 6000 chars totales de Discord
    const MAX_CAMPO = 400;

    // Embed 1: Datos generales + Táctica parte 1
    const embed1 = new EmbedBuilder()
      .setTitle('🎯 NUEVO EXAMEN DE INGRESO — G.E.O.F (1/2) 🎯')
      .setColor(COLOR_GEOF)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '👤 Nombre IC',       value: sf(d.nombre, 60),   inline: true },
        { name: '🎖️ Rango PFA',       value: sf(d.rango, 60),    inline: true },
        { name: '📅 Disponibilidad',  value: sf(d.disp, 60),     inline: true },
        { name: '🔗 Discord',         value: '<@' + uid + '>',   inline: true },
        { name: '🆔 Discord ID',      value: '`' + uid + '`',    inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '💬 Diferencia con otros', value: sf(d.diferencia, MAX_CAMPO), inline: false },
        { name: '📖 NVL + ejemplo', value: sf(d.nvl, MAX_CAMPO), inline: false },
        { name: '🚫 Por qué NO amenazar', value: sf(d.no_amenazar, MAX_CAMPO), inline: false },
        { name: '🎭 Toma de rehenes', value: sf(d.rehenes, MAX_CAMPO), inline: false },
        { name: '⚠️ Secuestro', value: sf(d.secuestro, MAX_CAMPO), inline: false },
        { name: '🚪 Ingreso táctico', value: sf(d.ingreso, MAX_CAMPO), inline: false }
      )
      .setFooter({ text: 'G.E.O.F • Parte 1 de 2' });

    // Embed 2: Táctica parte 2 + Motivación + Situación
    const embed2 = new EmbedBuilder()
      .setTitle('🎯 EXAMEN DE INGRESO — G.E.O.F (2/2) 🎯')
      .setColor(COLOR_GEOF)
      .addFields(
        { name: '📍 Perímetro (armado)', value: sf(d.perimetro, MAX_CAMPO), inline: false },
        { name: '❓ ¿Por qué G.E.O.F?', value: sf(d.por_que, MAX_CAMPO), inline: false },
        { name: '⚙️ Órdenes vs iniciativa', value: sf(d.iniciativa, MAX_CAMPO), inline: false },
        { name: '🗣️ ¿Quién negocia?', value: sf(d.negociador, MAX_CAMPO), inline: false },
        { name: '🎬 Situación táctica final', value: sf(d.situacion, MAX_CAMPO), inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'G.E.O.F • Sistema de Postulaciones' });

    const mencionRoles = ROLES_AUTORIZADOS.map(r => '<@&' + r + '>').join(' ');
    const nombreLimpio = (d.nombre || 'postulante').replace(/[^a-zA-Z0-9]/g, '').slice(0, 30) || 'postulante';
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ap_' + Date.now() + '_' + nombreLimpio + '_' + uid).setLabel('APROBAR').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('re_' + Date.now() + '_' + nombreLimpio + '_' + uid).setLabel('RECHAZAR').setStyle(ButtonStyle.Danger)
    );

    // Intentar enviar los embeds — si falla, NO borrar el estado
    try {
      const canalAprob = await client.channels.fetch(CANAL_APROBACION);
      await canalAprob.send({
        content: mencionRoles,
        embeds: [embed1, embed2],
        components: [row],
        allowedMentions: { roles: ROLES_AUTORIZADOS }
      });
    } catch (e) {
      console.error('[POSTULAR MODAL 4] Error publicando postulación:', e);
      // NO borramos el estado — el usuario puede reintentar
      await interaction.reply({
        content: '❌ **Hubo un error al enviar tu postulación.** Tus respuestas están guardadas. Volvé a intentar apretando el botón "🎯 POSTULARSE" del panel.\n\n_Error: ' + (e.message || 'desconocido') + '_',
        ephemeral: true
      });
      return;
    }

    // Solo si el envío fue OK, borrar el estado
    if (postulacionesActivas[uid] && postulacionesActivas[uid].timeoutId) clearTimeout(postulacionesActivas[uid].timeoutId);
    delete postulacionesActivas[uid];
    guardarPostulacionesActivas().catch(e => console.error('Save error:', e.message));

    await interaction.reply({ content: '✅ **Tu postulación fue enviada correctamente.**\n\nLa oficialidad del G.E.O.F revisará tu examen y te avisará por mensaje privado si es aprobada o rechazada.\n\n_— G.E.O.F • Grupo Especial de Operaciones Federales_', ephemeral: true });
    return;
  }

  // Modal operativo
  if (interaction.isModalSubmit() && interaction.customId === 'modal_operativo') {
    const tipo        = interaction.fields.getTextInputValue('op_tipo');
    const hora        = interaction.fields.getTextInputValue('op_hora');
    const lugar       = interaction.fields.getTextInputValue('op_lugar');
    const descripcion = interaction.fields.getTextInputValue('op_descripcion');
    const requisitos  = interaction.fields.getTextInputValue('op_requisitos') || 'Toda la unidad';

    const embed = new EmbedBuilder()
      .setTitle('🚨  OPERATIVO — G.E.O.F')
      .addFields(
        { name: '📋 Tipo',           value: tipo,        inline: true },
        { name: '🕐 Hora',           value: hora,        inline: true },
        { name: '📍 Zona',           value: lugar,       inline: true },
        { name: '👥 Participantes',  value: requisitos,  inline: true },
        { name: '👮 Convocado por',  value: '<@' + interaction.user.id + '>', inline: true },
        { name: '📝 Descripción',    value: descripcion, inline: false }
      )
      .setColor(COLOR_GEOF_ALERTA).setTimestamp()
      .setFooter({ text: 'G.E.O.F  •  Operaciones' });

    const rowAnota = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ANOTA_placeholder').setLabel('✅  Me anoto').setStyle(ButtonStyle.Success)
    );

    const canalOp = await client.channels.fetch(CANAL_OPERATIVOS);
    const msgEnviado = await canalOp.send({ content: '<@&' + ROL_GEOF + '>', embeds: [embed], components: [rowAnota] });

    const rowReal = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ANOTA_' + msgEnviado.id).setLabel('✅  Me anoto').setStyle(ButtonStyle.Success)
    );
    await msgEnviado.edit({ components: [rowReal] });
    asistentes[msgEnviado.id] = [];

    await interaction.reply({ content: '✅ Operativo anunciado en <#' + CANAL_OPERATIVOS + '>.', ephemeral: true });
    return;
  }

  // ==================== BOTONES ====================
  if (interaction.isButton()) {
    const id = interaction.customId;

    // Botón POSTULAR_INICIAR: abre modal 1
    if (id === 'POSTULAR_INICIAR') {
      const uid = interaction.user.id;

      const cooldownHasta = estaEnCooldown(uid);
      if (cooldownHasta) {
        await interaction.reply({
          content: '⏳ Ya te postulaste recientemente. Podés volver a intentar <t:' + Math.floor(cooldownHasta / 1000) + ':R>.',
          ephemeral: true
        });
        return;
      }

      if (postulacionesActivas[uid]) {
        const restanteMs = postulacionesActivas[uid].expiraTs - Date.now();
        const minutos = Math.max(0, Math.ceil(restanteMs / 60000));
        await interaction.reply({
          content: '❌ Ya tenés una postulación en curso. Te quedan **' + minutos + ' minutos** para terminarla.',
          ephemeral: true
        });
        return;
      }

      // Chequear si ya es GEOF
      if (interaction.member.roles.cache.has(ROL_GEOF) || interaction.member.roles.cache.has(ROL_TACTICO) || interaction.member.roles.cache.has(ROL_MIEMBRO_GEOF)) {
        await interaction.reply({ content: '❌ Ya sos parte del G.E.O.F. No podés volver a postularte.', ephemeral: true });
        return;
      }

      postulacionesActivas[uid] = {
        inicio: Date.now(),
        expiraTs: Date.now() + TIEMPO_MAX_POSTULACION_MS,
        timeoutId: null,
        datos: {}
      };
      iniciarTimeoutPostulacion(uid);
      guardarPostulacionesActivas().catch(e => console.error('Save error:', e.message));

      // Modal 1: datos personales
      const modal = new ModalBuilder()
        .setCustomId('POSTULAR_MODAL_1')
        .setTitle('Postulación G.E.O.F (1/4) — Datos');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('m1_nombre').setLabel('Nombre IC en el server')
            .setStyle(TextInputStyle.Short).setRequired(true).setMinLength(2).setMaxLength(60)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('m1_rango').setLabel('Rango actual en la PFA')
            .setStyle(TextInputStyle.Short).setRequired(true).setMinLength(2).setMaxLength(60)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('m1_disp').setLabel('Días disponibles por semana')
            .setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(30)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('m1_diferencia').setLabel('¿Qué te diferencia de otros postulantes?')
            .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(800)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('m1_confirm').setLabel('Escribí "ACEPTO" para confirmar')
            .setStyle(TextInputStyle.Short).setRequired(true).setMinLength(6).setMaxLength(10)
            .setPlaceholder('ACEPTO')
        )
      );
      await interaction.showModal(modal);
      return;
    }

    // Botones para continuar al siguiente modal
    if (id.startsWith('POSTULAR_SIG_')) {
      const paso = id.replace('POSTULAR_SIG_', '');
      const uid = interaction.user.id;

      if (!postulacionesActivas[uid]) {
        await interaction.reply({ content: '❌ Tu postulación se venció o no existe. Volvé a arrancar desde el panel.', ephemeral: true });
        return;
      }

      if (paso === '2') {
        const modal = new ModalBuilder()
          .setCustomId('POSTULAR_MODAL_2')
          .setTitle('Postulación G.E.O.F (2/4) — Táctica');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('m2_nvl').setLabel('¿Qué es el NVL? Poné un ejemplo')
              .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(600)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('m2_no_amenazar').setLabel('¿Por qué NO se debe amenazar al sospechoso?')
              .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(600)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('m2_rehenes').setLabel('¿Cómo actuarías en una toma de rehenes?')
              .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(600)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('m2_secuestro').setLabel('¿Cómo actuarías en un secuestro?')
              .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(600)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('m2_ingreso').setLabel('¿Cómo se hace un ingreso táctico?')
              .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(600)
          )
        );
        await interaction.showModal(modal);
        return;
      }

      if (paso === '3') {
        const modal = new ModalBuilder()
          .setCustomId('POSTULAR_MODAL_3')
          .setTitle('Postulación G.E.O.F (3/4) — Táctica II');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('m3_perimetro').setLabel('¿Qué es un perímetro y cómo se arma?')
              .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(700)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('m3_por_que').setLabel('¿Por qué querés ser parte del G.E.O.F?')
              .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(30).setMaxLength(1000)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('m3_iniciativa').setLabel('¿Seguir órdenes o tomar iniciativa?')
              .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(700)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('m3_negociador').setLabel('¿Quién negocia en una toma de rehenes?')
              .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(600)
          )
        );
        await interaction.showModal(modal);
        return;
      }

      if (paso === '4') {
        const modal = new ModalBuilder()
          .setCustomId('POSTULAR_MODAL_4')
          .setTitle('Postulación G.E.O.F (4/4) — Situación');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('m4_situacion').setLabel('Situación táctica')
              .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(50).setMaxLength(1500)
              .setPlaceholder('2 rehenes en tienda. Exigen vehículo + negociador. Sos el primer GEOF en llegar. ¿Cómo negociás?')
          )
        );
        await interaction.showModal(modal);
        return;
      }
      return;
    }

    // Botón "Me anoto" a un operativo
    if (id.startsWith('ANOTA_')) {
      const msgId = id.replace('ANOTA_', '');
      if (!asistentes[msgId]) asistentes[msgId] = [];

      if (asistentes[msgId].includes(interaction.user.id)) {
        await interaction.reply({ content: '❌ Ya te anotaste en este operativo.', ephemeral: true });
        return;
      }

      asistentes[msgId].push(interaction.user.id);
      await guardarAsistentes();
      const lista = asistentes[msgId].map(uid => '<@' + uid + '>').join('\n');

      const msgOriginal = interaction.message;
      const embedActualizado = EmbedBuilder.from(msgOriginal.embeds[0])
        .setFields(
          ...msgOriginal.embeds[0].fields.filter(f => f.name !== '👥 Asistentes confirmados'),
          { name: '👥 Asistentes confirmados (' + asistentes[msgId].length + ')', value: lista, inline: false }
        );

      await interaction.update({ embeds: [embedActualizado] });
      return;
    }

    // Botones de postulaciones (APROBAR / RECHAZAR)
    if (id.startsWith('ap_') || id.startsWith('re_')) {
      const tieneRol = ROLES_AUTORIZADOS.some(r => interaction.member.roles.cache.has(r));
      if (!tieneRol) { await interaction.reply({ content: '❌ No tenés permisos.', ephemeral: true }); return; }

      await interaction.deferUpdate();
      const parts = id.split('_');
      const accion = parts[0], discordId = parts[3];
      const revisor = interaction.member?.displayName || interaction.user.username;

      try {
        if (accion === 'ap') {
          // APROBAR
          if (!discordId) {
            const rowDone = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('done1').setLabel('APROBADO por ' + revisor + ' (sin ID)').setStyle(ButtonStyle.Success).setDisabled(true),
              new ButtonBuilder().setCustomId('done2').setLabel('RECHAZAR').setStyle(ButtonStyle.Danger).setDisabled(true)
            );
            await interaction.editReply({ components: [rowDone] });
            return;
          }

          let miembro;
          try { miembro = await interaction.guild.members.fetch(discordId); }
          catch (e) {
            await interaction.followUp({ content: '⚠️ No pude encontrar al usuario en el server.', ephemeral: true });
            return;
          }

          // Agregar los 2 roles GEOF SIN sacar ninguno de los que ya tiene
          try {
            const rolesAAgregar = [ROL_GEOF, ROL_TACTICO];
            for (const r of rolesAAgregar) {
              if (!miembro.roles.cache.has(r)) {
                await miembro.roles.add(r, 'Ingreso al G.E.O.F por aprobación');
              }
            }
          } catch (e) {
            console.error('Error asignando roles:', e.message);
            await interaction.followUp({ content: '⚠️ Aprobado pero no pude asignar los roles. Verificá jerarquía del bot.', ephemeral: true });
            return;
          }

          // Publicar embed de ingreso en CANAL_UPDATES
          const embedIngreso = new EmbedBuilder()
            .setTitle('🎯 NUEVO INGRESO — G.E.O.F')
            .setDescription('<@' + discordId + '> ha sido ingresado oficialmente al **G.E.O.F**.\n¡Bienvenido, Agente!')
            .addFields(
              { name: '👮 Ingresado por', value: revisor, inline: true },
              { name: '🔸 Roles asignados', value: 'GEOF + Táctico', inline: true }
            )
            .setColor(COLOR_GEOF_APROBAR)
            .setThumbnail(miembro.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: 'G.E.O.F  •  Sistema de Ingresos' });
          try {
            const canalUp = await client.channels.fetch(CANAL_UPDATES);
            await canalUp.send({ content: '<@' + discordId + '>', embeds: [embedIngreso] });
          } catch (e) { console.error('Publicar ingreso en updates:', e.message); }

          // DM al aprobado
          try {
            await miembro.send({ content: '✅ **¡Fuiste APROBADO en el G.E.O.F!**\n\nBienvenido al Grupo Especial de Operaciones Federales. Ya se te asignaron los roles y podés participar en los operativos.\n\n**Revisado por:** ' + revisor + '\n\n_— G.E.O.F · Kilombo RP_' });
          } catch (e) { /* DM cerrado */ }

          const rowDone = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('done1').setLabel('APROBADO por ' + revisor).setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId('done2').setLabel('RECHAZAR').setStyle(ButtonStyle.Danger).setDisabled(true)
          );
          await interaction.editReply({ components: [rowDone] });

        } else {
          // RECHAZAR
          const rowDone = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('done1').setLabel('APROBAR').setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId('done2').setLabel('RECHAZADO por ' + revisor).setStyle(ButtonStyle.Danger).setDisabled(true)
          );
          await interaction.editReply({ components: [rowDone] });

          if (!discordId) {
            await interaction.followUp({ content: '⚠️ Rechazado pero no hay Discord ID.', ephemeral: true });
            return;
          }

          // Aplicar cooldown de 24hs
          postulacionesCooldown[discordId] = Date.now() + COOLDOWN_POSTULACION_MS;
          guardarCooldowns().catch(e => console.error('Save cooldowns error:', e.message));

          // Enviar DM al postulante rechazado
          try {
            const miembro = await interaction.guild.members.fetch(discordId);
            await miembro.send({
              content: '❌ **Postulación rechazada — G.E.O.F**\n\nLamentamos informarte que tu postulación al **G.E.O.F** fue **RECHAZADA**.\n\n**Revisado por:** ' + revisor + '\n**Fecha:** ' + fecha() + '\n\nPodés volver a postularte en **24 horas**.\n\n_— G.E.O.F · Kilombo RP_'
            });
          } catch (e) {
            console.error('Error DM rechazo:', e.message);
            await interaction.followUp({ content: '⚠️ Rechazado, cooldown aplicado, pero no pude enviarle DM (DMs cerrados).', ephemeral: true });
            return;
          }
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

  // Todos los subcomandos requieren rol autorizado
  if (!tieneRol) {
    await interaction.reply({ content: '❌ No tenés permisos para usar este comando.', ephemeral: true });
    return;
  }

  // /geof panel-postulaciones
  if (sub === 'panel-postulaciones') {
    if (interaction.channelId !== CANAL_PANEL) {
      await interaction.reply({ content: '❌ Este comando solo puede usarse en <#' + CANAL_PANEL + '>.', ephemeral: true });
      return;
    }
    const embedPanel = new EmbedBuilder()
      .setTitle('🎯 G.E.O.F — POSTULACIONES ABIERTAS')
      .setDescription('Si querés formar parte del **Grupo Especial de Operaciones Federales**, la unidad táctica de élite de la PFA, este es tu lugar.\n\n' +
        '**Requisitos generales:**\n' +
        '• Ser oficial activo de la PFA (rango Sargento en adelante).\n' +
        '• Contar con micrófono funcional.\n' +
        '• Disponibilidad horaria para participar en operativos.\n' +
        '• Conocimiento sólido de protocolos tácticos, tomas de rehenes, secuestros e ingresos.\n' +
        '• Criterio en situaciones de alta presión.\n\n' +
        '**Cómo postularse:**\n' +
        '1. Hacé click en el botón **"🎯 POSTULARSE"** abajo.\n' +
        '2. Vas a completar **4 formularios** con datos, conocimiento táctico, motivación y una situación.\n' +
        '3. **Tenés 15 minutos** para completar todo. Si se te pasa el tiempo, deberás esperar 24 horas para reintentar.\n' +
        '4. Si te rechazan, también deberás esperar 24 horas antes de volver a postularte.\n\n' +
        '**Importante:** Contestá con criterio y honestidad. No sirve copiar respuestas — evaluamos tu forma de pensar y actuar.\n\n' +
        '_— G.E.O.F · Kilombo RP_')
      .setColor(COLOR_GEOF)
      .setFooter({ text: 'G.E.O.F  •  Sistema de Postulaciones' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('POSTULAR_INICIAR')
        .setLabel('🎯 POSTULARSE')
        .setStyle(ButtonStyle.Primary)
    );

    try {
      const canalPanel = await client.channels.fetch(CANAL_PANEL);
      await canalPanel.send({ embeds: [embedPanel], components: [row] });
      await interaction.reply({ content: '✅ Panel publicado en <#' + CANAL_PANEL + '>.', ephemeral: true });
    } catch (e) {
      console.error('Panel:', e.message);
      await interaction.reply({ content: '❌ Error al publicar el panel.', ephemeral: true });
    }
    return;
  }

  // /geof nuevo
  if (sub === 'nuevo') {
    if (interaction.channelId !== CANAL_UPDATES) {
      await interaction.reply({ content: '❌ Este comando solo puede usarse en <#' + CANAL_UPDATES + '>.', ephemeral: true });
      return;
    }
    const usuario = interaction.options.getUser('usuario');
    const miembro = await interaction.guild.members.fetch(usuario.id);
    try {
      const rolesAAgregar = [ROL_GEOF, ROL_TACTICO];
      for (const r of rolesAAgregar) {
        if (!miembro.roles.cache.has(r)) await miembro.roles.add(r, 'Ingreso manual al G.E.O.F');
      }
      const canalUp = await client.channels.fetch(CANAL_UPDATES);
      const embed = new EmbedBuilder().setTitle('🎯 NUEVO INGRESO — G.E.O.F')
        .setDescription('<@' + usuario.id + '> ha sido ingresado oficialmente al **G.E.O.F**.\n¡Bienvenido, Agente!')
        .addFields(
          { name: '👮 Ingresado por', value: revisor, inline: true },
          { name: '🔸 Roles asignados', value: 'GEOF + Táctico', inline: true }
        )
        .setColor(COLOR_GEOF_APROBAR).setThumbnail(usuario.displayAvatarURL()).setTimestamp()
        .setFooter({ text: 'G.E.O.F  •  Sistema de Ingresos' });
      await canalUp.send({ content: '<@' + usuario.id + '>', embeds: [embed] });
      await interaction.reply({ content: '✅ **' + miembro.displayName + '** ingresado al G.E.O.F.', ephemeral: true });
    } catch (err) { await interaction.reply({ content: '❌ Error al ingresar al miembro.', ephemeral: true }); }
    return;
  }

  // /geof operativo
  if (sub === 'operativo') {
    const modal = new ModalBuilder().setCustomId('modal_operativo').setTitle('Nuevo Operativo — G.E.O.F');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('op_tipo').setLabel('Tipo de operativo')
          .setStyle(TextInputStyle.Short).setPlaceholder('Ej: Toma de rehenes, Ingreso táctico, Perímetro')
          .setRequired(true).setMaxLength(60)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('op_hora').setLabel('Hora del operativo')
          .setStyle(TextInputStyle.Short).setPlaceholder('Ej: 21:00').setRequired(true).setMaxLength(20)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('op_lugar').setLabel('Zona / Ubicación')
          .setStyle(TextInputStyle.Short).setPlaceholder('Ej: Banco Central, Zona Norte').setRequired(true).setMaxLength(80)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('op_descripcion').setLabel('Descripción del operativo')
          .setStyle(TextInputStyle.Paragraph).setPlaceholder('Detallá objetivo, táctica y lo esperado de cada uno.')
          .setRequired(true).setMaxLength(500)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('op_requisitos').setLabel('Requisitos / Participantes')
          .setStyle(TextInputStyle.Short).setPlaceholder('Ej: Toda la unidad, mínimo 4 agentes')
          .setRequired(false).setMaxLength(100)
      )
    );
    await interaction.showModal(modal);
    return;
  }

  // /geof expulsar
  if (sub === 'expulsar') {
    const usuario = interaction.options.getUser('usuario');
    const motivo  = interaction.options.getString('motivo');
    const miembro = await interaction.guild.members.fetch(usuario.id);

    try {
      if (miembro.roles.cache.has(ROL_DUENO_GEOF)) {
        await interaction.reply({ content: '❌ No podés expulsar al **Dueño** del G.E.O.F.', ephemeral: true });
        return;
      }

      for (const id of TODOS_ROLES_GEOF) {
        if (miembro.roles.cache.has(id) && id !== ROL_DUENO_GEOF) {
          await miembro.roles.remove(id).catch(() => {});
        }
      }

      const canalUp = await client.channels.fetch(CANAL_UPDATES);
      const embed = new EmbedBuilder()
        .setTitle('🚫 EXPULSIÓN — G.E.O.F')
        .setDescription('<@' + usuario.id + '> ha sido **expulsado** del G.E.O.F.')
        .addFields(
          { name: '📋 Motivo',        value: motivo,                                 inline: false },
          { name: '👮 Expulsado por', value: '<@' + interaction.user.id + '>',       inline: true }
        )
        .setColor(COLOR_GEOF_RECHAZAR).setThumbnail(usuario.displayAvatarURL()).setTimestamp()
        .setFooter({ text: 'G.E.O.F  •  Sistema de Expulsiones' });

      await canalUp.send({ embeds: [embed] });
      await interaction.reply({ content: '✅ **' + miembro.displayName + '** fue expulsado del G.E.O.F.', ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Error al expulsar al miembro.', ephemeral: true });
    }
    return;
  }
});

// ==================== HEALTHCHECK HTTP SERVER ====================
const http = require('http');
const HEALTH_PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  const url = req.url || '/';
  if (url === '/healthcheck' || url === '/health' || url === '/') {
    const conectado = client.isReady();
    const status = conectado ? 200 : 503;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: conectado ? 'OK' : 'DISCONNECTED', botOnline: conectado, uptime_seconds: Math.floor(process.uptime()) }));
  } else {
    res.writeHead(404); res.end('Not Found');
  }
}).listen(HEALTH_PORT, () => {
  console.log('[HEALTH] Servidor HTTP en puerto ' + HEALTH_PORT);
});

// ==================== WATCHDOG DE AUTO-RECUPERACIÓN ====================
let desconectadoDesde = null;
setInterval(() => {
  if (process.uptime() * 1000 < 60000) return;
  const conectado = client.isReady();
  if (conectado) {
    if (desconectadoDesde !== null) {
      console.log('[WATCHDOG] Reconectado.');
      desconectadoDesde = null;
    }
    return;
  }
  if (desconectadoDesde === null) {
    desconectadoDesde = Date.now();
    console.warn('[WATCHDOG] Bot desconectado. Tolerancia 3 min.');
    return;
  }
  if (Date.now() - desconectadoDesde > 3 * 60 * 1000) {
    console.error('[WATCHDOG] Matando proceso para reinicio.');
    process.exit(1);
  }
}, 30000);

client.on('shardDisconnect', (event, shardId) => {
  console.warn('[DISCORD] Shard ' + shardId + ' desconectado. Código: ' + event.code);
});
client.on('shardError', (err) => {
  console.error('[DISCORD] Error en shard:', err.message);
});

// Verificar token antes del login
if (!process.env.TOKEN) {
  console.error('[FATAL] TOKEN no definida. Configurala en Railway.');
  process.exit(1);
}

client.login(process.env.TOKEN)
  .then(() => console.log('[LOGIN] Login OK. Esperando ready...'))
  .catch((err) => {
    console.error('[LOGIN] ERROR:', err.message);
    if (err.message && err.message.includes('TOKEN_INVALID')) {
      console.error('[LOGIN] >>> Token inválido. Regeneralo en Developer Portal.');
    }
  });
