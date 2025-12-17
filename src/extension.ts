import * as vscode from 'vscode';
import * as fs from 'fs';
import * as crypto from 'crypto';

let watchers: vscode.FileSystemWatcher[] = [];
let restartTimer: NodeJS.Timeout | undefined;
let outputChannel: vscode.OutputChannel | undefined;
let restartCommands: string[] = [];
let debugEnabled = false;
const DEFAULT_INCLUDES = ['package.json', 'package-lock.json', 'pnpm-lock.yaml'];
const fileHashCache = new Map<string, string>();

const t = vscode.l10n.t;

type FileEventKind = 'created' | 'changed' | 'deleted';
interface FileEventEntry {
	kind: FileEventKind;
	path: string;
	info?: FileStatSnapshot;
}

interface FileStatSnapshot {
	size: number;
	mtimeMs: number;
	ctimeMs: number;
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

function logDebug(message: string) {
	if (!debugEnabled) {
		return;
	}
	log(t('[debug] {0}', message));
}

function formatPath(fsPath: string) {
	return vscode.workspace.asRelativePath(fsPath, false) || fsPath;
}

function captureFileStat(fsPath: string): FileStatSnapshot | undefined {
	try {
		const stat = fs.statSync(fsPath);
		return {
			size: stat.size,
			mtimeMs: stat.mtimeMs,
			ctimeMs: stat.ctimeMs,
		};
	} catch (err) {
		logDebug(t('Stat failed for "{0}": {1}', formatPath(fsPath), String(err)));
		return undefined;
	}
}

function computeFileHash(fsPath: string): string | undefined {
	try {
		const buffer = fs.readFileSync(fsPath);
		return crypto.createHash('sha256').update(buffer).digest('hex');
	} catch (err) {
		logDebug(t('Hash failed for "{0}": {1}', formatPath(fsPath), String(err)));
		return undefined;
	}
}

function ensureContentChanged(fsPath: string, kind: Exclude<FileEventKind, 'deleted'>): boolean {
	const newHash = computeFileHash(fsPath);
	if (!newHash) {
		fileHashCache.delete(fsPath);
		return true; // fall back to triggering when hash is unavailable
	}

	const prevHash = fileHashCache.get(fsPath);
	fileHashCache.set(fsPath, newHash);

	if (prevHash && prevHash === newHash) {
		log(t('Skip restart: {0} event but content unchanged for "{1}"', kind, formatPath(fsPath)));
		logDebug(t('Skip {0}: no content change for "{1}" (hash={2})', kind, formatPath(fsPath), newHash));
		return false;
	}

	return true;
}

function formatFileInfo(info?: FileStatSnapshot) {
	if (!info) {
		return t('no stat info');
	}
	return t('size={0} bytes, mtime={1}, ctime={2}', info.size, new Date(info.mtimeMs).toISOString(), new Date(info.ctimeMs).toISOString());
}

function describeEvent(evt: FileEventEntry) {
	const base = `${formatPath(evt.path)} -> ${evt.kind}`;
	if (evt.info) {
		return `${base} (${formatFileInfo(evt.info)})`;
	}
	return base;
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

	const eventsToReport = pendingEvents.splice(0, pendingEvents.length);
	logDebug(t('Restart triggered with {0} pending event(s)', eventsToReport.length));

	const lines: string[] = [];

	if (eventsToReport.length > 0) {
		lines.push(t('Files changed'));
		for (const evt of eventsToReport) {
			lines.push(`- ${formatPath(evt.path)} ${kindLabel[evt.kind]}`);
		}
		logDebug(t('Pending events detail:\n{0}', eventsToReport.map((evt) => describeEvent(evt)).join('\n')));
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
				logDebug(t('Executing restart commands: {0}', restartCommands.join(', ')));
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
}

async function preloadFileHashes(includes: string[]) {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders?.length) {
		return;
	}
	let warmed = 0;
	for (const pattern of includes) {
		for (const folder of folders) {
			const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, pattern));
			for (const file of files) {
				const hash = computeFileHash(file.fsPath);
				if (hash) {
					fileHashCache.set(file.fsPath, hash);
					warmed += 1;
				}
			}
		}
	}
	logDebug(t('Preloaded {0} file hash(es) on activation', warmed));
}

export async function activate(context: vscode.ExtensionContext) {
	const extensionName = 'restart-language-server';
	outputChannel = vscode.window.createOutputChannel(t('Restart Language Server'));
	context.subscriptions.push(outputChannel);
	log(t('Extension activating'));

	const config = vscode.workspace.getConfiguration(extensionName);
	const enabled = config.get<boolean>('enable') || true;
	const includes = config.get<string[]>('includes') ?? DEFAULT_INCLUDES;
	restartCommands = config.get<string[]>('lsRestartCommands') || ['typescript.restartTsServer'];
	debugEnabled = config.get<boolean>('debug') || false;
	logDebug(t('Debug logging enabled'));

	if (!enabled) {
		log(t('Extension disabled via settings'));
		return;
	}
	if (!vscode.workspace.workspaceFolders?.[0]) {
		log(t('No workspace folders found; nothing to watch'));
		return;
	}
	logDebug(t('Loaded settings: includes={0}, commands={1}', includes.join(', ') || '[]', restartCommands.join(', ') || '[]'));

	await preloadFileHashes(includes);
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
			logDebug(t('Watcher ready for pattern "{0}" at workspace root {1}', it, workspace.uri.fsPath));
			watcher.onDidCreate((event) => {
				if (!ensureContentChanged(event.fsPath, 'created')) {
					return;
				}
				const info = captureFileStat(event.fsPath);
				pendingEvents.push({ kind: 'created', path: event.fsPath, info });
				log(t('File created: {0}; scheduling language server restart in {1}s', event.fsPath, DEBOUNCE_DELAY_MS / 1000));
				logDebug(t('Queued event: {0} -> {1}; pending={2}', 'created', formatPath(event.fsPath), pendingEvents.length));
				logDebug(t('Event info: {0}', formatFileInfo(info)));
				debouncedRestartTsServer();
			});
			watcher.onDidChange((event) => {
				if (!ensureContentChanged(event.fsPath, 'changed')) {
					return;
				}
				const info = captureFileStat(event.fsPath);
				pendingEvents.push({ kind: 'changed', path: event.fsPath, info });
				log(t('File changed: {0}; scheduling language server restart in {1}s', event.fsPath, DEBOUNCE_DELAY_MS / 1000));
				logDebug(t('Queued event: {0} -> {1}; pending={2}', 'changed', formatPath(event.fsPath), pendingEvents.length));
				logDebug(t('Event info: {0}', formatFileInfo(info)));
				debouncedRestartTsServer();
			});
			watcher.onDidDelete((event) => {
				fileHashCache.delete(event.fsPath);
				pendingEvents.push({ kind: 'deleted', path: event.fsPath });
				log(t('File deleted: {0}; scheduling language server restart in {1}s', event.fsPath, DEBOUNCE_DELAY_MS / 1000));
				logDebug(t('Queued event: {0} -> {1}; pending={2}', 'deleted', formatPath(event.fsPath), pendingEvents.length));
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
