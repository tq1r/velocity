import { SlashCommandBuilder } from 'discord.js';
import type { CommandInteraction } from 'discord.js';
import { upgradeUser } from '../api.js';

export const data = new SlashCommandBuilder()
  .setName('upgrade')
  .setDescription('Upgrade a user to premium')
  .addStringOption(opt => opt.setName('user_id').setDescription('The Velocity user ID').setRequired(true))
  .addStringOption(opt => opt.setName('tier').setDescription('Premium tier').setRequired(true).addChoices(
    { name: 'Monthly', value: 'monthly' },
    { name: 'Lifetime', value: 'lifetime' },
  ));

export async function execute(interaction: CommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.options.get('user_id')?.value as string;
  const tier = interaction.options.get('tier')?.value as 'monthly' | 'lifetime';

  try {
    const result = await upgradeUser(userId, tier);
    await interaction.editReply({
      content: `[OK] **${result.user?.name || userId}** upgraded to **${tier}** premium.`,
    });
  } catch (err) {
    await interaction.editReply({
      content: `[FAILED] ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
