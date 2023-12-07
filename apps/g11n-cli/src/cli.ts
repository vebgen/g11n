import { Command } from 'commander';
import { updateCommand } from "./update/command.js";

console.log('Hello world!');
export const program = new Command();
program
    .name('g11n CLI')
    .description('Manage globalization resources')

program.addCommand(updateCommand());
program.parse(process.argv);
