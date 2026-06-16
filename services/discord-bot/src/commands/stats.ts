import { SlashCommandBuilder } from 'discord.js';
import type { CommandInteraction } from 'discord.js';
import { getStats } from '../api.js';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Show premium statistics');

export async function execute(interaction: CommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const stats = await getStats();
    await interaction.editReply({
      content: [
        '**[PREMIUM STATISTICS]**',
        `Total users: **${stats.total_users}**`,
        `Lifetime premium: **${stats.lifetime_premium}**`,
        `Active monthly: **${stats.active_monthly}**`,
        `Active premium: **${stats.active_premium}**`,
      ].join('\n'),
    });
  } catch (err) {
    await interaction.editReply({
      content: `[FAILED] ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
