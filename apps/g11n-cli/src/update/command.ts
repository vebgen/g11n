import { Command } from 'commander';

export const updateCommand = () => {
    const command = new Command('update');
    command
        .action(() => {
            console.log('update command');
        });
    return command;
}
