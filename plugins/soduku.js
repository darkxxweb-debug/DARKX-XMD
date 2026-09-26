const { exec } = require("child_process");
const { promisify } = require("util");
const path = require("path");

const execAsync = promisify(exec);

module.exports = {
    command: ["sudoku", "sudokugen", "sudokusolve", "sdk"],
    category: "utility",
    description: "Generate Sudoku puzzles or solve them",
    execute: async (sock, m, { args, reply }) => {
        const scriptPath = path.join(__dirname, "..", "library", "sudoku.py");

        if (!args.length || args[0] === "help") {
            return reply(
                `🧩 *Sudoku*\n\n` +
                    `*Generate a puzzle:*\n` +
                    `\`.sudoku generate easy\`\n` +
                    `\`.sudoku generate medium\`\n` +
                    `\`.sudoku generate hard\`\n\n` +
                    `*Solve a puzzle:*\n` +
                    `\`.sudoku solve 530070000600195000098000060800060003400803001700020006060000280000419005000080079\`\n\n` +
                    `ℹ️ For solve: send 81 digits, use 0 for empty cells`
            );
        }

        const subCmd = args[0].toLowerCase();

        if (subCmd === "generate") {
            const difficulty = (args[1] || "medium").toLowerCase();
            if (!["easy", "medium", "hard"].includes(difficulty)) {
                return reply("❌ Invalid difficulty. Use: `easy`, `medium`, or `hard`");
            }

            await reply(`🧩 Generating ${difficulty} puzzle...`);

            try {
                const { stdout } = await execAsync(`python3 "${scriptPath}" generate ${difficulty}`, { timeout: 30000 });
                const data = JSON.parse(stdout.trim());

                if (data.error) {
                    return reply(`❌ ${data.error}`);
                }

                const diffEmoji = { easy: "🟢", medium: "🟡", hard: "🔴" };

                await sock.sendMessage(
                    m.chat,
                    {
                        text:
                            `🧩 *Sudoku — ${diffEmoji[difficulty]} ${difficulty.toUpperCase()}*\n` +
                            `📊 *Clues:* ${data.clues}/81\n\n` +
                            `*Puzzle:*\n\`\`\`\n${data.formatted_puzzle}\n\`\`\`\n\n` +
                            `*Puzzle code (to solve later):*\n\`${data.puzzle}\`\n\n` +
                            `_Use \`.sudoku solve ${data.puzzle}\` to reveal solution_`,
                    },
                    { quoted: m }
                );
            } catch (err) {
                reply(`❌ Failed to generate: ${err.message}`);
            }
        } else if (subCmd === "solve") {
            const grid = args[1]?.trim();

            if (!grid) {
                return reply(
                    "❌ Provide a puzzle code (81 digits, 0 = empty)\n\nExample:\n`.sudoku solve 530070000600195000...`"
                );
            }
            if (!/^[0-9]{81}$/.test(grid)) {
                return reply(`❌ Puzzle must be exactly 81 digits (0-9). Got ${grid.length} characters.`);
            }

            await reply("🔍 Solving puzzle...");

            try {
                const { stdout } = await execAsync(`python3 "${scriptPath}" solve ${grid}`, { timeout: 30000 });
                const data = JSON.parse(stdout.trim());

                if (data.error) {
                    return reply(`❌ ${data.error}`);
                }

                await sock.sendMessage(
                    m.chat,
                    {
                        text:
                            `🧩 *Sudoku Solved!*\n` +
                            `✅ *Filled:* ${data.filled} empty cells\n\n` +
                            `*Puzzle:*\n\`\`\`\n${data.formatted_puzzle}\n\`\`\`\n\n` +
                            `*Solution:*\n\`\`\`\n${data.formatted_solution}\n\`\`\``,
                    },
                    { quoted: m }
                );
            } catch (err) {
                reply(`❌ Failed to solve: ${err.message}`);
            }
        } else {
            reply(`❌ Unknown subcommand: *${subCmd}*\nUse \`generate\` or \`solve\``);
        }
    },
};
