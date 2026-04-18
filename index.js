const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, Events, REST, Routes, } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

const POSTULACIONES_CHANNEL_ID = '1493831725212635266';
const UPDATES_CHANNEL_ID       = '1493838384416952392';
const CANAL_OPERACIONES        = '1460759129864929507';
const GUILD_ID                 = '1000882508373688331';
const ROL_MIEMBRO_GEOF         = '1474252638832033884';

const ROLES_IDS = [
  '1474513244084371697',
  '1459343404155670710',
  '1384748336447361085',
  '1457168018269278402',
  '1412987223086731336',
];

// Roles que pueden usar /operacion (los que pasaste)
const ROLES_OPERACION = [
  '1459343404155670710',
  '1384748336447361085',
  '1457168018269278402',
  '1412987223086731336',
];

const ROLES_MENCIONES = ROLES_IDS.map(id => '<@&' + id + '>').join(' ');
const ROL_GEOF_OPERACION = '1384737385551495178';
const userResponses = new Map();

// Asistentes por operacion: { messageId: [userId, ...] }
const asistentesGeof = {};

// Imagenes pendientes para galeria
const fecha = () => new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

client.once(Events.ClientReady, async () => {
  console.log('Bot listo como ' + client.user.tag);
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
      body: [
        { name: 'setup-geof', description: 'Envia el panel de postulacion al G.E.O.F' },
        { name: 'operacion', description: 'Anuncia una operacion del G.E.O.F' },
      ]
    });
    console.log('Comandos registrados');
  } catch (err) { console.error(err); }
});

function btnSig(id, label) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(ButtonStyle.Primary)
  );
}

function getNombre(member) {
  return member?.nickname || member?.user?.globalName || member?.user?.username || 'Desconocido';
}

client.on(Events.InteractionCreate, async (interaction) => {

  // ===== MODAL OPERACION =====
  if (interaction.isModalSubmit() && interaction.customId === 'modal_operacion_geof') {
    const tipo        = interaction.fields.getTextInputValue('op_tipo');
    const hora        = interaction.fields.getTextInputValue('op_hora');
    const lugar       = interaction.fields.getTextInputValue('op_lugar');
    const descripcion = interaction.fields.getTextInputValue('op_descripcion');
    const requisitos  = interaction.fields.getTextInputValue('op_requisitos') || 'Toda la unidad';

    const embed = new EmbedBuilder()
      .setTitle('🚨  OPERACIÓN — G.E.O.F')
      .addFields(
        { name: '📋 Tipo',           value: tipo,        inline: true },
        { name: '🕐 Hora',           value: hora,        inline: true },
        { name: '📍 Zona',           value: lugar,       inline: true },
        { name: '👥 Participantes',  value: requisitos,  inline: true },
        { name: '👮 Convocado por',  value: '<@' + interaction.user.id + '>', inline: true },
        { name: '📝 Descripción',    value: descripcion, inline: false },
        { name: '⚠️ Importante',     value: 'Una vez anotado **no podés cancelar**. No asistir a la operación habiendo confirmado conlleva sanción.', inline: false }
      )
      .setColor(0xFFD700).setTimestamp()
      .setFooter({ text: 'G.E.O.F  •  Operaciones' });

    const rowAnota = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('GANOTA_placeholder')
        .setLabel('✅  Me anoto')
        .setStyle(ButtonStyle.Success)
    );

    const canalOp = await client.channels.fetch(CANAL_OPERACIONES);
    const msgEnviado = await canalOp.send({
      content: '<@&' + ROL_GEOF_OPERACION + '>',
      embeds: [embed],
      components: [rowAnota]
    });

    // Actualizar el boton con el messageId real
    const rowReal = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('GANOTA_' + msgEnviado.id)
        .setLabel('✅  Me anoto')
        .setStyle(ButtonStyle.Success)
    );
    await msgEnviado.edit({ components: [rowReal] });
    asistentesGeof[msgEnviado.id] = [];

    await interaction.reply({ content: '✅ Operación anunciada en #anuncios.', ephemeral: true });
    return;
  }

  // ===== BOTONES =====
  if (interaction.isButton()) {

    // --- Boton Me Anoto (Geof) ---
    if (interaction.customId.startsWith('GANOTA_')) {
      const msgId = interaction.customId.replace('GANOTA_', '');
      if (!asistentesGeof[msgId]) asistentesGeof[msgId] = [];

      if (asistentesGeof[msgId].includes(interaction.user.id)) {
        await interaction.reply({ content: '❌ Ya te anotaste en esta operación.', ephemeral: true });
        return;
      }

      asistentesGeof[msgId].push(interaction.user.id);
      const lista = asistentesGeof[msgId].map(uid => '<@' + uid + '>').join('\n');

      const msgOriginal = interaction.message;
      const embedActualizado = EmbedBuilder.from(msgOriginal.embeds[0])
        .setFields(
          ...msgOriginal.embeds[0].fields.filter(f => f.name !== '👥 Asistentes confirmados'),
          { name: '✅ Asistentes confirmados (' + asistentesGeof[msgId].length + ')', value: lista, inline: false }
        );

      await interaction.update({ embeds: [embedActualizado] });
      return;
    }

    // --- Boton Postular ---
    if (interaction.customId === 'postular_geof') {
      userResponses.delete(interaction.user.id);
      await interaction.showModal(buildModal('geof_paso1', 'G.E.O.F - Paso 1 de 4', [
        { id: 'nombre_ic',   label: 'Nombre IC',                            style: 'Short' },
        { id: 'rango_pfa',   label: 'Rango actual en la PFA',               style: 'Short' },
        { id: 'dias_semana', label: 'Dias disponibles por semana',           style: 'Short', placeholder: 'Ej: Lunes, Miercoles, Viernes' },
        { id: 'diferencia',  label: 'Que te diferencia de otros postulantes?', style: 'Paragraph' },
        { id: 'nvl',         label: 'Que es el NVL (no valorar vida)? + ejemplo', style: 'Paragraph' },
      ]));
      return;
    }

    if (interaction.customId === 'geof_abrir2') {
      await interaction.showModal(buildModal('geof_paso2', 'G.E.O.F - Paso 2 de 4', [
        { id: 'no_amenazar',    label: 'Por que NO amenazar al sospechoso?',  style: 'Paragraph' },
        { id: 'toma_rehenes',   label: 'Como actuarias en una toma de rehenes?', style: 'Paragraph' },
        { id: 'secuestro',      label: 'Como actuarias en un secuestro?',     style: 'Paragraph' },
        { id: 'ingreso_tactico',label: 'Como se hace un ingreso tactico?',    style: 'Paragraph' },
        { id: 'perimetro_arma', label: 'Que es un perimetro y como se arma?', style: 'Paragraph' },
      ]));
      return;
    }

    if (interaction.customId === 'geof_abrir3') {
      await interaction.showModal(buildModal('geof_paso3', 'G.E.O.F - Paso 3 de 4', [
        { id: 'por_que_geof',       label: 'Por que queres ser parte del G.E.O.F?', style: 'Paragraph' },
        { id: 'ordenes_iniciativa', label: 'Seguir ordenes o tomar iniciativa?',    style: 'Paragraph' },
        { id: 'negociador',         label: 'Quien negocia en una toma de rehenes?', style: 'Paragraph', placeholder: 'Quien es el encargado y como se procede?' },
      ]));
      return;
    }

    if (interaction.customId === 'geof_abrir4') {
      const modal = new ModalBuilder().setCustomId('geof_paso4').setTitle('G.E.O.F - Paso 4 de 4 (Final)');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('situacion_rehenes')
          .setLabel('SITUACION TACTICA (lee el placeholder)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setPlaceholder('2 rehenes en tienda. Exige vehiculo y negociador. Sos el 1er GEOF. Como negocias?')
      ));
      await interaction.showModal(modal);
      return;
    }

    // --- Aceptar postulacion ---
    if (interaction.customId.startsWith('aceptar_')) {
      const tieneRol = interaction.member.roles.cache.some(r => ROLES_IDS.includes(r.id));
      if (!tieneRol) { await interaction.reply({ content: '❌ No tenes permisos.', ephemeral: true }); return; }
      const nombreAceptador = getNombre(interaction.member);
      const postulantUserId = interaction.customId.replace('aceptar_', '');
      const postulanteMember = await interaction.guild.members.fetch(postulantUserId).catch(() => null);
      if (postulanteMember) { try { await postulanteMember.roles.add(ROL_MIEMBRO_GEOF); } catch (err) { console.error(err); } }
      const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0x00cc44).setFooter({ text: '✅ Aceptada por ' + nombreAceptador });
      await interaction.message.edit({ embeds: [embed], components: [] });
      const updatesCanal = await client.channels.fetch(UPDATES_CHANNEL_ID);
      await updatesCanal.send('📋 **Update:** <@' + postulantUserId + '> **> NUEVO** <@&' + ROL_MIEMBRO_GEOF + '>');
      await interaction.reply({ content: '✅ Postulacion **ACEPTADA** por ' + nombreAceptador + '.', ephemeral: true });
      return;
    }

    // --- Rechazar postulacion ---
    if (interaction.customId.startsWith('rechazar_')) {
      const tieneRol = interaction.member.roles.cache.some(r => ROLES_IDS.includes(r.id));
      if (!tieneRol) { await interaction.reply({ content: '❌ No tenes permisos.', ephemeral: true }); return; }
      const nombreAceptador = getNombre(interaction.member);
      const postulantUserId = interaction.customId.replace('rechazar_', '');
      const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xff3333).setFooter({ text: '❌ Rechazada por ' + nombreAceptador });
      await interaction.message.edit({ embeds: [embed], components: [] });
      const updatesCanal = await client.channels.fetch(UPDATES_CHANNEL_ID);
      await updatesCanal.send('📋 **Update:** <@' + postulantUserId + '> **> No aprobaste el examen, intentalo nuevamente en 24 horas.**');
      await interaction.reply({ content: '❌ Postulacion **RECHAZADA** por ' + nombreAceptador + '.', ephemeral: true });
      return;
    }
  }

  // ===== SLASH COMMANDS =====
  if (interaction.isChatInputCommand()) {

    // /setup-geof
    if (interaction.commandName === 'setup-geof') {
      const embed = new EmbedBuilder()
        .setTitle('Postulacion al G.E.O.F - Unete a Nuestro Equipo!')
        .setDescription('Queres formar parte del **Grupo Especial de Operaciones y Fuerzas**?\n\nCompleta el formulario y postulate.\nNuestros superiores evaluaran tu solicitud.')
        .setColor(0xFFD700)
        .setFooter({ text: 'G.E.O.F | Kilombo RP 2022 - 2025' })
        .setTimestamp();
      await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('postular_geof').setLabel('Enviar postulacion').setStyle(ButtonStyle.Primary)
      )] });
      return;
    }

    // /operacion
    if (interaction.commandName === 'operacion') {
      const tieneRol = interaction.member.roles.cache.some(r => ROLES_OPERACION.includes(r.id));
      if (!tieneRol) {
        await interaction.reply({ content: '❌ No tenés permisos para anunciar operaciones.', ephemeral: true });
        return;
      }

      const modal = new ModalBuilder().setCustomId('modal_operacion_geof').setTitle('Nueva Operación — G.E.O.F');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('op_tipo').setLabel('Tipo de operación')
            .setStyle(TextInputStyle.Short).setPlaceholder('Ej: Toma de rehenes, Persecución, Allanamiento...')
            .setRequired(true).setMaxLength(60)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('op_hora').setLabel('Hora de la operación')
            .setStyle(TextInputStyle.Short).setPlaceholder('Ej: 21:00')
            .setRequired(true).setMaxLength(20)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('op_lugar').setLabel('Zona / Ubicación')
            .setStyle(TextInputStyle.Short).setPlaceholder('Ej: Banco Central, Zona Norte...')
            .setRequired(true).setMaxLength(80)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('op_descripcion').setLabel('Descripción de la operación')
            .setStyle(TextInputStyle.Paragraph).setPlaceholder('Detallá el objetivo y la táctica.')
            .setRequired(true).setMaxLength(500)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('op_requisitos').setLabel('Requisitos / Quiénes participan')
            .setStyle(TextInputStyle.Short).setPlaceholder('Ej: Toda la unidad, solo rangos altos...')
            .setRequired(false).setMaxLength(100)
        )
      );
      await interaction.showModal(modal);
      return;
    }
  }

  // ===== MODALES POSTULACION =====
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'geof_paso1') {
      userResponses.set(interaction.user.id, { paso1: {
        nombre_ic:   interaction.fields.getTextInputValue('nombre_ic'),
        rango_pfa:   interaction.fields.getTextInputValue('rango_pfa'),
        dias_semana: interaction.fields.getTextInputValue('dias_semana'),
        diferencia:  interaction.fields.getTextInputValue('diferencia'),
        nvl:         interaction.fields.getTextInputValue('nvl'),
      }});
      await interaction.reply({ content: '**Paso 1 completado!** Hace clic para continuar.', components: [btnSig('geof_abrir2', 'Continuar al Paso 2')], ephemeral: true });
      return;
    }

    if (interaction.customId === 'geof_paso2') {
      const existing = userResponses.get(interaction.user.id) || {};
      existing.paso2 = {
        no_amenazar:    interaction.fields.getTextInputValue('no_amenazar'),
        toma_rehenes:   interaction.fields.getTextInputValue('toma_rehenes'),
        secuestro:      interaction.fields.getTextInputValue('secuestro'),
        ingreso_tactico:interaction.fields.getTextInputValue('ingreso_tactico'),
        perimetro_arma: interaction.fields.getTextInputValue('perimetro_arma'),
      };
      userResponses.set(interaction.user.id, existing);
      await interaction.reply({ content: '**Paso 2 completado!** Hace clic para continuar.', components: [btnSig('geof_abrir3', 'Continuar al Paso 3')], ephemeral: true });
      return;
    }

    if (interaction.customId === 'geof_paso3') {
      const existing = userResponses.get(interaction.user.id) || {};
      existing.paso3 = {
        por_que_geof:       interaction.fields.getTextInputValue('por_que_geof'),
        ordenes_iniciativa: interaction.fields.getTextInputValue('ordenes_iniciativa'),
        negociador:         interaction.fields.getTextInputValue('negociador'),
      };
      userResponses.set(interaction.user.id, existing);
      await interaction.reply({ content: '**Paso 3 completado!** Ultimo paso, hace clic para finalizar.', components: [btnSig('geof_abrir4', 'Paso Final 4')], ephemeral: true });
      return;
    }

    if (interaction.customId === 'geof_paso4') {
      const stored = userResponses.get(interaction.user.id);
      if (!stored?.paso1 || !stored?.paso2 || !stored?.paso3) {
        await interaction.reply({ content: 'Error: respuestas perdidas. Empeza de nuevo con /setup-geof.', ephemeral: true });
        return;
      }
      const { paso1, paso2, paso3 } = stored;
      const situacion = interaction.fields.getTextInputValue('situacion_rehenes');
      userResponses.delete(interaction.user.id);
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      const nombrePostulante = getNombre(member);
      const embed = new EmbedBuilder()
        .setTitle('Nueva Postulacion de ' + nombrePostulante)
        .setColor(0xFFD700).setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: '━━━━━━ DATOS GENERALES ━━━━━━', value: '\u200B' },
          { name: '👤 Nombre IC', value: paso1.nombre_ic, inline: true },
          { name: '🎖️ Rango actual PFA', value: paso1.rango_pfa, inline: true },
          { name: '📅 Dias disponibles', value: paso1.dias_semana, inline: true },
          { name: '⭐ ¿Que te diferencia?', value: paso1.diferencia },
          { name: '❓ ¿Que es el NVL?', value: paso1.nvl },
          { name: '━━━━━━ CONOCIMIENTO TACTICO ━━━━━━', value: '\u200B' },
          { name: '🚫 ¿Por que NO amenazar?', value: paso2.no_amenazar },
          { name: '🔒 ¿Toma de rehenes?', value: paso2.toma_rehenes },
          { name: '🚨 ¿Secuestro?', value: paso2.secuestro },
          { name: '🏠 ¿Ingreso tactico?', value: paso2.ingreso_tactico },
          { name: '🔶 ¿Perimetro?', value: paso2.perimetro_arma },
          { name: '━━━━━━ MOTIVACION ━━━━━━', value: '\u200B' },
          { name: '🦅 ¿Por que el G.E.O.F?', value: paso3.por_que_geof },
          { name: '⚖️ ¿Ordenes o iniciativa?', value: paso3.ordenes_iniciativa },
          { name: '🗣️ ¿Quien negocia?', value: paso3.negociador },
          { name: '━━━━━━ SITUACION TACTICA ━━━━━━', value: '\u200B' },
          { name: '🔴 Situacion tactica', value: situacion },
        )
        .setFooter({ text: 'UserID: ' + interaction.user.id + ' | Pendiente de revision' })
        .setTimestamp();
      const canal = await client.channels.fetch(POSTULACIONES_CHANNEL_ID);
      await canal.send({
        content: '🔔 Nueva postulacion al G.E.O.F! ' + ROLES_MENCIONES,
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('aceptar_' + interaction.user.id).setLabel('✅ Aceptar').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('rechazar_' + interaction.user.id).setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger)
        )]
      });
      await interaction.reply({ content: '**Postulacion enviada con exito!** El G.E.O.F revisara tu solicitud. Buena suerte!', ephemeral: true });
      return;
    }
  }
});

function buildModal(customId, title, fields) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  for (const f of fields) {
    const input = new TextInputBuilder()
      .setCustomId(f.id).setLabel(f.label)
      .setStyle(f.style === 'Short' ? TextInputStyle.Short : TextInputStyle.Paragraph)
      .setRequired(true);
    if (f.placeholder) input.setPlaceholder(f.placeholder);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  return modal;
}

client.login(process.env.TOKEN);
