import Debug from 'debug';
import { Command } from 'commander';

export const rootDebug = Debug('g11n-cli')

export const printVerboseHook = (thisCommand: Command) => {

  const options = thisCommand.opts();

  if (options['verbose']) {
    Debug.enable('g11n-cli*');
    rootDebug(`CLI arguments`);
    rootDebug(options);
  }
}
