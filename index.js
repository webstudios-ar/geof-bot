const {
  Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, Events, REST, Routes,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
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

client.on(Events.InteractionCreate, async (interaction) => {

  // /setup-geof
  if (interaction.isChatInputCommand() && interaction.commandName === 'setup-geof') {
    const embed = new EmbedBuilder()
      .setTitle('Postulacion al G.E.O.F - Unete a Nuestro Equipo!')
      .setDescription('Queres formar parte del Grupo Especial de Operaciones y Fuerzas?\n\nCompleta el formulario y postulate.\nNuestros superiores evaluaran tu solicitud.\nAsegurate de cumplir con todos los requisitos.')
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

  // Boton postular -> abre PASO 1
  if (interaction.isButton() && interaction.customId === 'postular_geof') {
    userResponses.delete(interaction.user.id);
    await interaction.showModal(buildModal1());
    return;
  }

  // PASO 1 submit -> guarda y abre PASO 2 directamente
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
    // Abrimos el siguiente modal DIRECTAMENTE desde el submit
    await interaction.showModal(buildModal2());
    return;
  }

  // PASO 2 submit -> guarda y abre PASO 3 directamente
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
    await interaction.showModal(buildModal3());
    return;
  }

  // PASO 3 submit -> guarda y abre PASO 4 directamente
  if (interaction.isModalSubmit() && interaction.customId === 'geof_paso3') {
    const existing = userResponses.get(interaction.user.id) || {};
    existing.paso3 = {
      por_que_geof: interaction.fields.getTextInputValue('por_que_geof'),
      ordenes_iniciativa: interaction.fields.getTextInputValue('ordenes_iniciativa'),
      negociador: interaction.fields.getTextInputValue('negociador'),
    };
    userResponses.set(interaction.user.id, existing);
    await interaction.showModal(buildModal4());
    return;
  }

  // PASO 4 submit -> enviar postulacion completa
  if (interaction.isModalSubmit() && interaction.customId === 'geof_paso4') {
    const stored = userResponses.get(interaction.user.id);
    if (!stored?.paso1 || !stored?.paso2 || !stored?.paso3) {
      await interaction.reply({ content: 'Error: tus respuestas se perdieron. Comenzá de nuevo.', ephemeral: true });
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
    await interaction.reply({ content: 'Postulacion enviada con exito! El G.E.O.F revisara tu solicitud. Buena suerte!', ephemeral: true });
    return;
  }

  // Aceptar
  if (interaction.isButton() && interaction.customId.startsWith('aceptar_')) {
    const tieneRol = interaction.member.roles.cache.some(r => ROLES_PERMITIDOS.includes(r.name.toLowerCase()));
    if (!tieneRol) { await interaction.reply({ content: 'No tenes permisos.', ephemeral: true }); return; }
    const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0x00cc44).setFooter({ text: 'Aceptada por ' + interaction.user.username });
    await interaction.message.edit({ embeds: [embed], components: [] });
    await interaction.reply({ content: 'Postulacion ACEPTADA por ' + interaction.user });
    return;
  }

  // Rechazar
  if (interaction.isButton() && interaction.customId.startsWith('rechazar_')) {
    const tieneRol = interaction.member.roles.cache.some(r => ROLES_PERMITIDOS.includes(r.name.toLowerCase()));
    if (!tieneRol) { await interaction.reply({ content: 'No tenes permisos.', ephemeral: true }); return; }
    const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xff3333).setFooter({ text: 'Rechazada por ' + interaction.user.username });
    await interaction.message.edit({ embeds: [embed], components: [] });
    await interaction.reply({ content: 'Postulacion RECHAZADA por ' + interaction.user });
    return;
  }
});

function buildModal1() {
  const modal = new ModalBuilder().setCustomId('geof_paso1').setTitle('G.E.O.F - Paso 1 de 4');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nombre_ic').setLabel('Nombre IC').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rango_pfa').setLabel('Rango actual en la PFA').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dias_semana').setLabel('Dias disponibles por semana').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ej: Lunes, Miercoles, Viernes')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('diferencia').setLabel('Que te diferencia de otros postulantes?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nvl').setLabel('Que es el NVL (no valorar vida)? + ejemplo').setStyle(TextInputStyle.Paragraph).setRequired(true))
  );
  return modal;
}

function buildModal2() {
  const modal = new ModalBuilder().setCustomId('geof_paso2').setTitle('G.E.O.F - Paso 2 de 4');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('no_amenazar').setLabel('Por que NO amenazar al sospechoso?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('toma_rehenes').setLabel('Como actuarias en una toma de rehenes?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('secuestro').setLabel('Como actuarias en un secuestro?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ingreso_tactico').setLabel('Como se hace un ingreso tactico a una casa?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('perimetro_arma').setLabel('Que es un perimetro y como se arma?').setStyle(TextInputStyle.Paragraph).setRequired(true))
  );
  return modal;
}

function buildModal3() {
  const modal = new ModalBuilder().setCustomId('geof_paso3').setTitle('G.E.O.F - Paso 3 de 4');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('por_que_geof').setLabel('Por que queres ser parte del G.E.O.F?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ordenes_iniciativa').setLabel('Seguir ordenes o tomar iniciativa? Por que?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('negociador').setLabel('Quien negocia en una toma de rehenes?').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Quien es el encargado y como se procede correctamente?'))
  );
  return modal;
}

function buildModal4() {
  const modal = new ModalBuilder().setCustomId('geof_paso4').setTitle('G.E.O.F - Paso 4 de 4 (Final)');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('situacion_rehenes')
        .setLabel('SITUACION TACTICA - Lee el placeholder')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Operativo activo: sujeto armado con 2 rehenes en una tienda. Exige vehiculo, retirar unidades y hablar con negociador. Sos el primer GEOF en contacto. Como inicias la negociacion y que estrategia seguis para resolver sin bajas?')
    )
  );
  return modal;
}

client.login(process.env.TOKEN);
