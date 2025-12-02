import * as vscode from 'vscode';

let watchers: vscode.FileSystemWatcher[] = [];
let restartTimer: NodeJS.Timeout | undefined;
let outputChannel: vscode.OutputChannel | undefined;
let restartCommands: string[] = [];

const t = vscode.l10n.t;

type FileEventKind = 'created' | 'changed' | 'deleted';
interface FileEventEntry {
	kind: FileEventKind;
	path: string;
}

const pendingEvents: FileEventEntry[] = [];

const DEBOUNCE_DELAY_MS = 10000; // 10 seconds

function log(message: string) {
	const line = `[${new Date().toISOString()}] ${message}`;
	if (outputChannel) {
		outputChannel.appendLine(line);
	}
	console.log(line);
}

function formatPath(fsPath: string) {
	return vscode.workspace.asRelativePath(fsPath, false) || fsPath;
}

function debouncedRestartTsServer() {
	if (restartTimer) {
		clearTimeout(restartTimer);
	}
	restartTimer = setTimeout(async () => {
		await restartLanguageServers();
		restartTimer = undefined;
	}, DEBOUNCE_DELAY_MS);
}

async function restartLanguageServers() {
	const kindLabel: Record<FileEventKind, string> = {
		created: t('created'),
		changed: t('changed'),
		deleted: t('deleted'),
	};

	const lines: string[] = [];

	if (pendingEvents.length > 0) {
		lines.push(t('Files changed'));
		for (const evt of pendingEvents) {
			lines.push(`- ${formatPath(evt.path)} ${kindLabel[evt.kind]}`);
		}
	} else {
		lines.push(t('No file changes recorded'));
	}

	lines.push('');
	lines.push(t('Commands executed'));
	if (restartCommands.length > 0) {
		restartCommands.forEach((cmd) => lines.push(`- ${cmd}`));
	} else {
		lines.push(`- ${t('No commands configured')}`);
	}

	const detail = lines.join('\n');
	const title = t('Language servers restarting');

	log(`${title}\n\n${detail}`);

	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: title
	}, async () => {
		const minDuration = new Promise((resolve) => setTimeout(resolve, 5000));
		const commandExecution = async () => {
			if (restartCommands.length > 0) {
				try {
					await Promise.all(restartCommands.map((cmd) => vscode.commands.executeCommand(cmd)));
				} catch (err) {
					log(t('Error executing restart commands: {0}', String(err)));
					vscode.window.showErrorMessage(t('Language server restart failed: {0}', String(err)));
				}
			}
		};
		await Promise.all([minDuration, commandExecution()]);
	});

	pendingEvents.splice(0, pendingEvents.length);
}

export function activate(context: vscode.ExtensionContext) {
	const extensionName = 'restart-language-server';
	outputChannel = vscode.window.createOutputChannel(t('Restart Language Server'));
	context.subscriptions.push(outputChannel);
	log(t('Extension activating'));

	const config = vscode.workspace.getConfiguration(extensionName);
	const enabled = config.get<boolean>('enable') || true;
	const includes = config.get<string[]>('includes') || [];
	restartCommands = config.get<string[]>('lsRestartCommands') || ['typescript.restartTsServer'];

	if (!enabled) {
		log(t('Extension disabled via settings'));
		return;
	}
	if (!vscode.workspace.workspaceFolders?.[0]) {
		log(t('No workspace folders found; nothing to watch'));
		return;
	}
	if (includes.length === 0) {
		log(t('No watch patterns configured; extension will stay idle'));
	}
	if (restartCommands.length === 0) {
		log(t('No restart commands configured; will log changes but execute nothing'));
	} else {
		log(t('Restart commands: {0}', restartCommands.join(', ')));
	}

	for (const it of includes) {
		for (const workspace of vscode.workspace.workspaceFolders) {
			const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspace, it));
			watchers.push(watcher);
			log(t('Watching "{0}" in workspace "{1}"', it, workspace.name ?? workspace.uri.fsPath));
			watcher.onDidCreate((event) => {
				pendingEvents.push({ kind: 'created', path: event.fsPath });
				log(t('File created: {0}; scheduling language server restart in {1}s', event.fsPath, DEBOUNCE_DELAY_MS / 1000));
				debouncedRestartTsServer();
			});
			watcher.onDidChange((event) => {
				pendingEvents.push({ kind: 'changed', path: event.fsPath });
				log(t('File changed: {0}; scheduling language server restart in {1}s', event.fsPath, DEBOUNCE_DELAY_MS / 1000));
				debouncedRestartTsServer();
			});
			watcher.onDidDelete((event) => {
				pendingEvents.push({ kind: 'deleted', path: event.fsPath });
				log(t('File deleted: {0}; scheduling language server restart in {1}s', event.fsPath, DEBOUNCE_DELAY_MS / 1000));
				debouncedRestartTsServer();
			});
			context.subscriptions.push(watcher);
		}
	}

	log(t('Extension activated'));
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
	outputChannel?.dispose();
	outputChannel = undefined;
}
