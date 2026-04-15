const {
  Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, Events, REST, Routes,
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
});

const POSTULACIONES_CHANNEL_ID = '1493831725212635266';
const GUILD_ID = '1000882508373688331';
const ROLES_PERMITIDOS = ['jefe geof', 'sub jefe geof', 'comandante geof', 'director geof'];
const userResponses = new Map();

client.once(Events.ClientReady, async () => {
  console.log('Bot listo como ' + client.user.tag);
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
      body: [{ name: 'setup-geof', description: 'Envia el panel de postulacion al G.E.O.F' }]
    });
    console.log('Comandos registrados');
  } catch (err) { console.error(err); }
});

// Boton de siguiente (reutilizable)
function btnSig(id, label) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(ButtonStyle.Primary)
  );
}

client.on(Events.InteractionCreate, async (interaction) => {

  // /setup-geof
  if (interaction.isChatInputCommand() && interaction.commandName === 'setup-geof') {
    const embed = new EmbedBuilder()
      .setTitle('Postulacion al G.E.O.F - Unete a Nuestro Equipo!')
      .setDescription('Queres formar parte del **Grupo Especial de Operaciones y Fuerzas**?\n\nCompleta el formulario y postulate para unirte a nuestra unidad de elite.\nNuestros superiores evaluaran tu solicitud.\nAsegurate de cumplir con todos los requisitos.')
      .setColor(0xFFD700)
      .setFooter({ text: 'G.E.O.F | Kilombo RP 2022 - 2025' })
      .setTimestamp();
    await interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('postular_geof').setLabel('Enviar postulacion').setStyle(ButtonStyle.Primary)
      )]
    });
    return;
  }

  // BOTON: iniciar -> abre modal paso 1
  if (interaction.isButton() && interaction.customId === 'postular_geof') {
    userResponses.delete(interaction.user.id);
    await interaction.showModal(buildModal('geof_paso1', 'G.E.O.F - Paso 1 de 4', [
      { id: 'nombre_ic', label: 'Nombre IC', style: 'Short' },
      { id: 'rango_pfa', label: 'Rango actual en la PFA', style: 'Short' },
      { id: 'dias_semana', label: 'Dias disponibles por semana', style: 'Short', placeholder: 'Ej: Lunes, Miercoles, Viernes' },
      { id: 'diferencia', label: 'Que te diferencia de otros postulantes?', style: 'Paragraph' },
      { id: 'nvl', label: 'Que es el NVL (no valorar vida)? + ejemplo', style: 'Paragraph' },
    ]));
    return;
  }

  // MODAL SUBMIT paso 1 -> guarda y muestra boton para paso 2
  if (interaction.isModalSubmit() && interaction.customId === 'geof_paso1') {
    userResponses.set(interaction.user.id, {
      paso1: {
        nombre_ic: interaction.fields.getTextInputValue('nombre_ic'),
        rango_pfa: interaction.fields.getTextInputValue('rango_pfa'),
        dias_semana: interaction.fields.getTextInputValue('dias_semana'),
        diferencia: interaction.fields.getTextInputValue('diferencia'),
        nvl: interaction.fields.getTextInputValue('nvl'),
      }
    });
    await interaction.reply({ content: '**Paso 1 completado!** Hace clic en el boton para continuar.', components: [btnSig('geof_abrir2', 'Continuar al Paso 2 →')], ephemeral: true });
    return;
  }

  // BOTON: abrir modal paso 2
  if (interaction.isButton() && interaction.customId === 'geof_abrir2') {
    await interaction.showModal(buildModal('geof_paso2', 'G.E.O.F - Paso 2 de 4', [
      { id: 'no_amenazar', label: 'Por que NO amenazar al sospechoso?', style: 'Paragraph' },
      { id: 'toma_rehenes', label: 'Como actuarias en una toma de rehenes?', style: 'Paragraph' },
      { id: 'secuestro', label: 'Como actuarias en un secuestro?', style: 'Paragraph' },
      { id: 'ingreso_tactico', label: 'Como se hace un ingreso tactico a una casa?', style: 'Paragraph' },
      { id: 'perimetro_arma', label: 'Que es un perimetro y como se arma?', style: 'Paragraph' },
    ]));
    return;
  }

  // MODAL SUBMIT paso 2 -> guarda y muestra boton para paso 3
  if (interaction.isModalSubmit() && interaction.customId === 'geof_paso2') {
    const existing = userResponses.get(interaction.user.id) || {};
    existing.paso2 = {
      no_amenazar: interaction.fields.getTextInputValue('no_amenazar'),
      toma_rehenes: interaction.fields.getTextInputValue('toma_rehenes'),
      secuestro: interaction.fields.getTextInputValue('secuestro'),
      ingreso_tactico: interaction.fields.getTextInputValue('ingreso_tactico'),
      perimetro_arma: interaction.fields.getTextInputValue('perimetro_arma'),
    };
    userResponses.set(interaction.user.id, existing);
    await interaction.reply({ content: '**Paso 2 completado!** Hace clic en el boton para continuar.', components: [btnSig('geof_abrir3', 'Continuar al Paso 3 →')], ephemeral: true });
    return;
  }

  // BOTON: abrir modal paso 3
  if (interaction.isButton() && interaction.customId === 'geof_abrir3') {
    await interaction.showModal(buildModal('geof_paso3', 'G.E.O.F - Paso 3 de 4', [
      { id: 'por_que_geof', label: 'Por que queres ser parte del G.E.O.F?', style: 'Paragraph' },
      { id: 'ordenes_iniciativa', label: 'Seguir ordenes o tomar iniciativa? Por que?', style: 'Paragraph' },
      { id: 'negociador', label: 'Quien negocia en una toma de rehenes?', style: 'Paragraph', placeholder: 'Quien es el encargado y como se procede?' },
    ]));
    return;
  }

  // MODAL SUBMIT paso 3 -> guarda y muestra boton para paso 4
  if (interaction.isModalSubmit() && interaction.customId === 'geof_paso3') {
    const existing = userResponses.get(interaction.user.id) || {};
    existing.paso3 = {
      por_que_geof: interaction.fields.getTextInputValue('por_que_geof'),
      ordenes_iniciativa: interaction.fields.getTextInputValue('ordenes_iniciativa'),
      negociador: interaction.fields.getTextInputValue('negociador'),
    };
    userResponses.set(interaction.user.id, existing);
    await interaction.reply({ content: '**Paso 3 completado!** Ultimo paso — hace clic para finalizar.', components: [btnSig('geof_abrir4', 'Paso Final 4 →')], ephemeral: true });
    return;
  }

  // BOTON: abrir modal paso 4 (situacion tactica)
  if (interaction.isButton() && interaction.customId === 'geof_abrir4') {
    const modal = new ModalBuilder().setCustomId('geof_paso4').setTitle('G.E.O.F - Paso 4 de 4 (Final)');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('situacion_rehenes')
          .setLabel('SITUACION TACTICA - Lee el placeholder')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setPlaceholder('Sujeto armado con 2 rehenes en una tienda. Exige vehiculo, retirar unidades y negociador. Sos el primer GEOF en contacto. Como inicias la negociacion y que estrategia usas para resolver sin bajas?')
      )
    );
    await interaction.showModal(modal);
    return;
  }

  // MODAL SUBMIT paso 4 -> enviar postulacion completa
  if (interaction.isModalSubmit() && interaction.customId === 'geof_paso4') {
    const stored = userResponses.get(interaction.user.id);
    if (!stored?.paso1 || !stored?.paso2 || !stored?.paso3) {
      await interaction.reply({ content: 'Error: tus respuestas se perdieron. Comenzá de nuevo con /setup-geof.', ephemeral: true });
      return;
    }
    const { paso1, paso2, paso3 } = stored;
    const situacion = interaction.fields.getTextInputValue('situacion_rehenes');
    userResponses.delete(interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle('Nueva Postulacion de ' + interaction.user.username)
      .setColor(0xFFD700)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '━━━ DATOS GENERALES ━━━', value: '\u200B' },
        { name: 'Nombre IC', value: paso1.nombre_ic, inline: true },
        { name: 'Rango actual PFA', value: paso1.rango_pfa, inline: true },
        { name: 'Dias disponibles', value: paso1.dias_semana, inline: true },
        { name: 'Que te diferencia?', value: paso1.diferencia },
        { name: 'Que es el NVL?', value: paso1.nvl },
        { name: '━━━ CONOCIMIENTO TACTICO ━━━', value: '\u200B' },
        { name: 'Por que no amenazar al sospechoso?', value: paso2.no_amenazar },
        { name: 'Toma de rehenes', value: paso2.toma_rehenes },
        { name: 'Secuestro', value: paso2.secuestro },
        { name: 'Ingreso tactico', value: paso2.ingreso_tactico },
        { name: 'Perimetro', value: paso2.perimetro_arma },
        { name: '━━━ MOTIVACION ━━━', value: '\u200B' },
        { name: 'Por que G.E.O.F?', value: paso3.por_que_geof },
        { name: 'Ordenes o iniciativa?', value: paso3.ordenes_iniciativa },
        { name: 'Quien negocia?', value: paso3.negociador },
        { name: '━━━ SITUACION TACTICA ━━━', value: '\u200B' },
        { name: 'Respuesta a la situacion de rehenes', value: situacion },
      )
      .setFooter({ text: 'Discord ID: ' + interaction.user.id + ' | Pendiente de revision' })
      .setTimestamp();

    const canal = await client.channels.fetch(POSTULACIONES_CHANNEL_ID);
    await canal.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('aceptar_' + interaction.user.id).setLabel('Aceptar').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('rechazar_' + interaction.user.id).setLabel('Rechazar').setStyle(ButtonStyle.Danger)
      )]
    });
    await interaction.reply({ content: '**Postulacion enviada con exito!** El G.E.O.F revisara tu solicitud. Buena suerte!', ephemeral: true });
    return;
  }

  // Aceptar postulacion
  if (interaction.isButton() && interaction.customId.startsWith('aceptar_')) {
    const tieneRol = interaction.member.roles.cache.some(r => ROLES_PERMITIDOS.includes(r.name.toLowerCase()));
    if (!tieneRol) { await interaction.reply({ content: 'No tenes permisos para esto.', ephemeral: true }); return; }
    const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0x00cc44).setFooter({ text: 'Aceptada por ' + interaction.user.username });
    await interaction.message.edit({ embeds: [embed], components: [] });
    await interaction.reply({ content: 'Postulacion **ACEPTADA** por ' + interaction.user });
    return;
  }

  // Rechazar postulacion
  if (interaction.isButton() && interaction.customId.startsWith('rechazar_')) {
    const tieneRol = interaction.member.roles.cache.some(r => ROLES_PERMITIDOS.includes(r.name.toLowerCase()));
    if (!tieneRol) { await interaction.reply({ content: 'No tenes permisos para esto.', ephemeral: true }); return; }
    const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xff3333).setFooter({ text: 'Rechazada por ' + interaction.user.username });
    await interaction.message.edit({ embeds: [embed], components: [] });
    await interaction.reply({ content: 'Postulacion **RECHAZADA** por ' + interaction.user });
    return;
  }
});

// Helper para construir modales rapidamente
function buildModal(customId, title, fields) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  for (const f of fields) {
    const input = new TextInputBuilder()
      .setCustomId(f.id)
      .setLabel(f.label)
      .setStyle(f.style === 'Short' ? TextInputStyle.Short : TextInputStyle.Paragraph)
      .setRequired(true);
    if (f.placeholder) input.setPlaceholder(f.placeholder);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  return modal;
}

client.login(process.env.TOKEN);
