import 'dotenv/config';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import * as upgrade from './commands/upgrade.js';
import * as revoke from './commands/revoke.js';
import * as check from './commands/check.js';
import * as stats from './commands/stats.js';
import * as setowner from './commands/setowner.js';

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;

if (!token || !guildId) {
  console.error('Missing DISCORD_TOKEN or GUILD_ID environment variables');
  process.exit(1);
}

const commands = [upgrade.data.toJSON(), revoke.data.toJSON(), check.data.toJSON(), stats.data.toJSON(), setowner.data.toJSON()];

const rest = new REST({ version: '10' }).setToken(token);

try {
  console.log(`Registering ${commands.length} guild commands...`);
  const data = await rest.put(Routes.applicationGuildCommands(await getClientId(token), guildId), { body: commands }) as any[];
  console.log(`Registered ${data.length} commands successfully.`);
} catch (err) {
  console.error('Failed to register commands:', err);
  process.exit(1);
}

async function getClientId(token: string): Promise<string> {
  const res = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bot ${token}` },
  });
  const data = await res.json() as any;
  return data.id;
}
