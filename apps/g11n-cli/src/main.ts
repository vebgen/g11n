import { Command } from 'commander';
import { updateCommand } from "./update";


export const program = new Command();
program
    .name('g11n-cli')
    .version('0.0.9')
    .description('Manage globalization resources')

program.addCommand(updateCommand());
program.parse(process.argv);
