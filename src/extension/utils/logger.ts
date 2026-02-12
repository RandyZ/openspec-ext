import * as vscode from 'vscode';

export class Logger {
  private outputChannel: vscode.OutputChannel;

  constructor(channelName: string = 'OpenSpec') {
    this.outputChannel = vscode.window.createOutputChannel(channelName);
  }

  info(message: string): void {
    this.log('INFO', message);
  }

  warn(message: string, error?: Error): void {
    const errorMessage = error ? `${message}: ${error.message}` : message;
    this.log('WARN', errorMessage);
    if (error?.stack) {
      this.outputChannel.appendLine(error.stack);
    }
  }

  error(message: string, error?: Error): void {
    const errorMessage = error ? `${message}: ${error.message}` : message;
    this.log('ERROR', errorMessage);
    if (error?.stack) {
      this.outputChannel.appendLine(error.stack);
    }
  }

  debug(message: string, error?: Error): void {
    const errorMessage = error ? `${message}: ${error.message}` : message;
    this.log('DEBUG', errorMessage);
    if (error?.stack) {
      this.outputChannel.appendLine(error.stack);
    }
  }

  show(): void {
    this.outputChannel.show();
  }

  dispose(): void {
    this.outputChannel.dispose();
  }

  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`);
  }
}

export let logger: Logger;

export function initLogger(): Logger {
  logger = new Logger('OpenSpec');
  return logger;
}
