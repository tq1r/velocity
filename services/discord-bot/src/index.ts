import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import * as upgrade from './commands/upgrade.js';
import * as revoke from './commands/revoke.js';
import * as check from './commands/check.js';
import * as stats from './commands/stats.js';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN environment variable');
  process.exit(1);
}

const commands = new Map<string, { execute: (interaction: any) => Promise<void> }>();
commands.set('upgrade', upgrade);
commands.set('revoke', revoke);
commands.set('check', check);
commands.set('stats', stats);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Velocity Bot ready as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error executing ${interaction.commandName}:`, err);
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: 'An unexpected error occurred.' });
    } else {
      await interaction.reply({ content: 'An unexpected error occurred.', ephemeral: true });
    }
  }
});

client.login(token);
