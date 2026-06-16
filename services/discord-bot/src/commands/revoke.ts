import { SlashCommandBuilder } from 'discord.js';
import type { CommandInteraction } from 'discord.js';
import { revokePremium } from '../api.js';

export const data = new SlashCommandBuilder()
  .setName('revoke')
  .setDescription('Revoke premium access from a user')
  .addStringOption(opt => opt.setName('user_id').setDescription('The Velocity user ID').setRequired(true));

export async function execute(interaction: CommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.options.get('user_id')?.value as string;

  try {
    await revokePremium(userId);
    await interaction.editReply({
      content: `✅ Premium revoked for **${userId}**.`,
    });
  } catch (err) {
    await interaction.editReply({
      content: `❌ Failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
