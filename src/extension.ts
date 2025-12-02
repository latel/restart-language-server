import * as vscode from 'vscode';

let watchers: vscode.FileSystemWatcher[] = [];
let restartTimer: NodeJS.Timeout | undefined;

function debouncedRestartTsServer() {
	if (restartTimer) {
		clearTimeout(restartTimer);
	}
	restartTimer = setTimeout(() => {
		console.log('restarting typescript language server');
		vscode.commands.executeCommand('typescript.restartTsServer');
		restartTimer = undefined;
	}, 10000); // 10 seconds debounce
}

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
		for (const workspace of vscode.workspace.workspaceFolders) {
			const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspace, it));
			watchers.push(watcher);
			watcher.onDidCreate((event) => {
				console.log('file created:', event.fsPath, 'scheduling typescript language server restart');
				debouncedRestartTsServer();
			});
			watcher.onDidDelete((event) => {
				console.log('file deleted:', event.fsPath, 'scheduling typescript language server restart');
				debouncedRestartTsServer();
			});
			context.subscriptions.push(watcher);
		}
	}

	console.log('"restart-language-server" is now active!');
}

export function deactivate() {
	if (restartTimer) {
		clearTimeout(restartTimer);
		restartTimer = undefined;
	}
	let watcher;
	while (watcher = watchers.shift()) {
		watcher.dispose();
	}
}
