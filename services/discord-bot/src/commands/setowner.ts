import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { CommandInteraction } from 'discord.js';
import { setOwner } from '../api.js';

export const data = new SlashCommandBuilder()
  .setName('setowner')
  .setDescription('Set the Velocity owner account (bypasses all AI limits)')
  .addStringOption(opt => opt.setName('user_id').setDescription('The Velocity user ID').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: CommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.options.get('user_id')?.value as string;

  try {
    const result = await setOwner(userId);
    await interaction.editReply({
      content: `👑 Owner set to **${result.owner_user_id}**. This user now has unlimited AI and no restrictions.`,
    });
  } catch (err) {
    await interaction.editReply({
      content: `❌ Failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
