const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  Events,
  REST,
  Routes,
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

const ROLES_PERMITIDOS = [
  'jefe geof',
  'sub jefe geof',
  'comandante geof',
  'director geof',
];

const userResponses = new Map();

client.once(Events.ClientReady, async () => {
  console.log('Bot listo como ' + client.user.tag);
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  const commands = [{ name: 'setup-geof', description: 'Envia el panel de postulacion al G.E.O.F en este canal' }];
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
    console.log('Comandos slash registrados para el servidor');
  } catch (err) {
    console.error('Error registrando comandos:', err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {

  if (interaction.isChatInputCommand() && interaction.commandName === 'setup-geof') {
    const embed = new EmbedBuilder()
      .setTitle('Postulacion al G.E.O.F - Unete a Nuestro Equipo!')
      .setDescription('Queres formar parte del Grupo Especial de Operaciones y Fuerzas?\n\nCompleta el formulario y postulate para unirte a nuestra unidad de elite.\nUna vez completada la postulacion, nuestros superiores evaluaran tu solicitud.\nAsegurate de cumplir con todos los requisitos antes de postularte.')
      .setColor(0xFFD700)
      .setFooter({ text: 'G.E.O.F | Kilombo RP 2022 - 2025' })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('postular_geof').setLabel('Enviar postulacion').setStyle(ButtonStyle.Primary)
    );
    await interaction.reply({ embeds: [embed], components: [row] });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'postular_geof') {
    userResponses.delete(interaction.user.id);
    const modal = new ModalBuilder().setCustomId('geof_paso1').setTitle('Formulario G.E.O.F - Paso 1 de 3');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nombre_ic').setLabel('Nombre IC').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rango_pfa').setLabel('Rango actual en la PFA').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dias_semana').setLabel('Dias disponibles por semana').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ej: Lunes, Miercoles, Viernes')),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('diferencia').setLabel('Que te diferencia de otros postulantes?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nvl').setLabel('Que es el NVL? (no valorar vida) + ejemplo').setStyle(TextInputStyle.Paragraph).setRequired(true))
    );
    await interaction.showModal(modal);
    return;
  }

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
    await interaction.reply({
      content: 'Paso 1 completado. Haz clic en Siguiente para continuar.',
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('geof_siguiente_2').setLabel('Siguiente').setStyle(ButtonStyle.Primary))],
      ephemeral: true,
    });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'geof_siguiente_2') {
    const modal = new ModalBuilder().setCustomId('geof_paso2').setTitle('Formulario G.E.O.F - Paso 2 de 3');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('no_amenazar').setLabel('Por que NO se debe amenazar al sospechoso?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('toma_rehenes').setLabel('Como actuarias en una toma de rehenes?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('secuestro').setLabel('Como actuarias en un secuestro?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ingreso_tactico').setLabel('Como se hace un ingreso tactico a una casa?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('perimetro_arma').setLabel('Que es un perimetro y como se arma?').setStyle(TextInputStyle.Paragraph).setRequired(true))
    );
    await interaction.showModal(modal);
    return;
  }

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
    await interaction.reply({
      content: 'Paso 2 completado. Haz clic en Siguiente para continuar.',
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('geof_siguiente_3').setLabel('Siguiente').setStyle(ButtonStyle.Primary))],
      ephemeral: true,
    });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'geof_siguiente_3') {
    const modal = new ModalBuilder().setCustomId('geof_paso3').setTitle('Formulario G.E.O.F - Paso 3 de 3');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('por_que_geof').setLabel('Por que queres ser parte del G.E.O.F?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ordenes_iniciativa').setLabel('Seguir ordenes o tomar iniciativa? Por que?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('negociador').setLabel('Quien negocia en una toma de rehenes?').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Quien es el encargado y como se procede correctamente?')),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('situacion_rehenes').setLabel('SITUACION: Toma de rehenes (lee el placeholder)').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Operativo activo: sujeto armado con 2 rehenes en una tienda. Exige vehiculo, retirar unidades y hablar con negociador. Sos el primer GEOF en contacto. Como inicias la negociacion y que estrategia seguis para resolver sin bajas?'))
    );
    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'geof_paso3') {
    const stored = userResponses.get(interaction.user.id);
    if (!stored || !stored.paso1 || !stored.paso2) {
      await interaction.reply({ content: 'Error: tus respuestas se perdieron. Comenzá la postulacion nuevamente.', ephemeral: true });
      return;
    }
    const { paso1, paso2 } = stored;
    const paso3 = {
      por_que_geof: interaction.fields.getTextInputValue('por_que_geof'),
      ordenes_iniciativa: interaction.fields.getTextInputValue('ordenes_iniciativa'),
      negociador: interaction.fields.getTextInputValue('negociador'),
      situacion_rehenes: interaction.fields.getTextInputValue('situacion_rehenes'),
    };
    userResponses.delete(interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle('Nueva Postulacion de ' + interaction.user.username)
      .setColor(0xFFD700)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: 'DATOS GENERALES', value: '\u200B' },
        { name: 'Nombre IC', value: paso1.nombre_ic, inline: true },
        { name: 'Rango actual PFA', value: paso1.rango_pfa, inline: true },
        { name: 'Dias disponibles', value: paso1.dias_semana, inline: true },
        { name: 'Que te diferencia?', value: paso1.diferencia },
        { name: 'Que es el NVL?', value: paso1.nvl },
        { name: 'CONOCIMIENTO TACTICO', value: '\u200B' },
        { name: 'Por que no amenazar al sospechoso?', value: paso2.no_amenazar },
        { name: 'Toma de rehenes', value: paso2.toma_rehenes },
        { name: 'Secuestro', value: paso2.secuestro },
        { name: 'Ingreso tactico', value: paso2.ingreso_tactico },
        { name: 'Perimetro', value: paso2.perimetro_arma },
        { name: 'MOTIVACION Y SITUACION', value: '\u200B' },
        { name: 'Por que G.E.O.F?', value: paso3.por_que_geof },
        { name: 'Ordenes o iniciativa?', value: paso3.ordenes_iniciativa },
        { name: 'Quien negocia?', value: paso3.negociador },
        { name: 'SITUACION - Respuesta tactica', value: paso3.situacion_rehenes },
      )
      .setFooter({ text: 'Discord ID: ' + interaction.user.id + ' - Postulacion pendiente de revision' })
      .setTimestamp();

    const botones = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('aceptar_' + interaction.user.id).setLabel('Aceptar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('rechazar_' + interaction.user.id).setLabel('Rechazar').setStyle(ButtonStyle.Danger)
    );

    const canal = await client.channels.fetch(POSTULACIONES_CHANNEL_ID);
    await canal.send({ embeds: [embed], components: [botones] });
    await interaction.reply({ content: 'Postulacion enviada con exito! El equipo del G.E.O.F revisara tu solicitud. Mucha suerte!', ephemeral: true });
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('aceptar_')) {
    const tieneRol = interaction.member.roles.cache.some((r) => ROLES_PERMITIDOS.includes(r.name.toLowerCase()));
    if (!tieneRol) { await interaction.reply({ content: 'No tenes permisos para aceptar postulaciones.', ephemeral: true }); return; }
    const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0x00cc44).setFooter({ text: 'Aceptada por ' + interaction.user.username });
    await interaction.message.edit({ embeds: [embed], components: [] });
    await interaction.reply({ content: 'Postulacion aceptada por ' + interaction.user });
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('rechazar_')) {
    const tieneRol = interaction.member.roles.cache.some((r) => ROLES_PERMITIDOS.includes(r.name.toLowerCase()));
    if (!tieneRol) { await interaction.reply({ content: 'No tenes permisos para rechazar postulaciones.', ephemeral: true }); return; }
    const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xff3333).setFooter({ text: 'Rechazada por ' + interaction.user.username });
    await interaction.message.edit({ embeds: [embed], components: [] });
    await interaction.reply({ content: 'Postulacion rechazada por ' + interaction.user });
    return;
  }
});

client.login(process.env.TOKEN);
