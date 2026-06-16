import { SlashCommandBuilder } from 'discord.js';
import type { CommandInteraction } from 'discord.js';
import { checkPremium } from '../api.js';

export const data = new SlashCommandBuilder()
  .setName('check')
  .setDescription('Check premium status of a user')
  .addStringOption(opt => opt.setName('user_id').setDescription('The Velocity user ID').setRequired(true));

export async function execute(interaction: CommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.options.get('user_id')?.value as string;

  try {
    const result = await checkPremium(userId);
    const tier = result.premium_tier || 'none';
    const expires = result.premium_expires_at
      ? `<t:${Math.floor(new Date(result.premium_expires_at).getTime() / 1000)}:R>`
      : '—';

    await interaction.editReply({
      content: [
        `**User:** ${result.name || userId}`,
        `**Premium:** ${result.premium ? '✅ Active' : '❌ Inactive'}`,
        `**Tier:** ${tier}`,
        `**Expires:** ${expires}`,
      ].join('\n'),
    });
  } catch (err) {
    await interaction.editReply({
      content: `❌ Failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
