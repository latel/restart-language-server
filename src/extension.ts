// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const extensionName = 'restart-language-server';

	const config = vscode.workspace.getConfiguration(extensionName);
	const enabled = config.get<boolean>('enable') || true;
	const includes = config.get<string[]>('includes') || [];

	if (!enabled) {
		console.log('"restart-language-server" is disabled');
		return;
	}
	if (!vscode.workspace.workspaceFolders?.[0]) {
		console.log('"restart-language-server" found no workspace folders');
		return;
	}

	for (const it of includes) {
		const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], it));
		watcher.onDidCreate((event) => {
			console.log('file created:', event.fsPath, 'restarting typescript language server');
			vscode.commands.executeCommand('typescript.restartTsServer');
		});
		watcher.onDidDelete((event) => {
			console.log('file deleted:', event.fsPath, 'restarting typescript language server');
			vscode.commands.executeCommand('typescript.restartTsServer');
		});
		context.subscriptions.push(watcher);
		console.log('watched', it);
	}
		

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('"restart-language-server" is now active!');
}

// This method is called when your extension is deactivated
export function deactivate() {}
