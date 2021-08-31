import * as vscode from 'vscode';
import * as fs from 'fs';

let terminalDisposed: boolean = true;
let interactiveTerminal: vscode.Terminal;
let configuration: vscode.WorkspaceConfiguration;
const defaultInterpreter: string = "scala";
let requiredFiles = ["\\lib\\kdb-studio.jar","\\lib\\org-openide-awt-RELEASE113.jar","\\lib\\jfreechart-1.0.14.jar","\\lib\\poi-ooxml-4.1.2.jar","\\lib\\poi-4.1.2.jar","\\lib\\jackson-databind-2.11.2.jar","\\lib\\org-netbeans-api-annotations-common-RELEASE113.jar","\\lib\\org-openide-filesystems-RELEASE113.jar","\\lib\\org-openide-util-ui-RELEASE113.jar","\\lib\\org-openide-util-RELEASE113.jar","\\lib\\org-openide-util-lookup-RELEASE113.jar","\\lib\\jcommon-1.0.17.jar","\\lib\\xml-apis-1.3.04.jar","\\lib\\itext-2.1.5.jar","\\lib\\commons-codec-1.13.jar","\\lib\\commons-collections4-4.4.jar","\\lib\\commons-math3-3.6.1.jar","\\lib\\SparseBitSet-1.2.jar","\\lib\\poi-ooxml-schemas-4.1.2.jar","\\lib\\commons-compress-1.19.jar","\\lib\\curvesapi-1.06.jar","\\lib\\jackson-annotations-2.11.2.jar","\\lib\\jackson-core-2.11.2.jar","\\lib\\bcmail-jdk14-138.jar","\\lib\\bcprov-jdk14-138.jar","\\lib\\xmlbeans-3.1.0.jar"];

function initialiseInteractiveScala() {
	let interpreter: string|undefined = configuration.get("interpreter");
	let requiredFiles: Array<string>|undefined = configuration.get("requiredFiles");
	if(!interpreter) {
		interpreter = defaultInterpreter;
	}

	disposeTerminal();

	interactiveTerminal = vscode.window.createTerminal("Interactive Scala");
	let extDirPath = "";
	let extDir =  vscode.extensions.getExtension ("kimktang.qvs");
	if(extDir){
		extDirPath = extDir.extensionPath;
	}
	let modifiedInterpreter = interpreter+" -cp \""+extDirPath + "\\kdb-studio\\lib\\*.jar\"";
	interactiveTerminal.sendText(modifiedInterpreter, true);
	interactiveTerminal.show(false);
	terminalDisposed = false;

	//A bit hacky, but the interpreter must have opened when following is sent.
	setTimeout(() => {
		if(requiredFiles) {
			requiredFiles.forEach(file => {
				if(fs.existsSync(file)) {
					interactiveTerminal.sendText(":require "+file, true);
				} else {
					vscode.window.showErrorMessage("Following required file was not found and is not loaded into the Scala REPL: "+file);
				}
			});
		}
	}, 2000);
}

function sendSelectionToTerminal(activeTextEditor: vscode.TextEditor) {
	if(terminalDisposed) { 
		initialiseInteractiveScala();
	}

	let selection = activeTextEditor.selection;
	let text = "";
	if(selection.isEmpty) {
		let lineNumber = selection.active.line;
		let line = activeTextEditor.document.lineAt(lineNumber);
		text = line.text;
		
		let newCursorPosition = selection.active.translate(1,0);
		activeTextEditor.selection = new vscode.Selection(newCursorPosition, newCursorPosition);
	} else {
		text = activeTextEditor.document.getText(selection);
	}

	sendToTerminal(text);
}

function sendFileToTerminal(activeTextEditor: vscode.TextEditor) {
	if(terminalDisposed) { 
		initialiseInteractiveScala();
	}

	let text = activeTextEditor.document.getText();

	sendToTerminal(text);
}

function sendToTerminal(text: string) {
	text = text.trim();
	interactiveTerminal.show(true);
	interactiveTerminal.sendText(`:paste`);
	interactiveTerminal.sendText(`${text}`);
	interactiveTerminal.sendText("\u0004");
}

function disposeTerminal() {
	if(interactiveTerminal) {
		interactiveTerminal.dispose();
	}
	terminalDisposed = true;
}

function reset() {
	disposeTerminal();
	initialiseInteractiveScala();
}

export function activate(context: vscode.ExtensionContext) {
	let executeInInteractiveScalaCommand = vscode.commands.registerCommand('interactiveScala.executeInInteractiveScala', () => {
		let activeTextEditor = vscode.window.activeTextEditor;
		if(activeTextEditor && activeTextEditor.document.languageId === "q") {
			sendSelectionToTerminal(activeTextEditor);
		}
	});

	let executeFileInInteractiveScalaCommand = vscode.commands.registerCommand('interactiveScala.executeFileInInteractiveScala', () => {
		let activeTextEditor = vscode.window.activeTextEditor;
		if(activeTextEditor && activeTextEditor.document.languageId === "q") {
			sendFileToTerminal(activeTextEditor);
		}
	});

	let resetInteractiveScalaCommand = vscode.commands.registerCommand('interactiveScala.resetInteractiveScala', reset);

	let configurationChanged = vscode.workspace.onDidChangeConfiguration(e => {
		if(e.affectsConfiguration("qvs")) {
			configuration = vscode.workspace.getConfiguration("qvs");
			initialiseInteractiveScala();
		}
	});

	let disposedTerminal = vscode.window.onDidCloseTerminal(e => {
		if(interactiveTerminal && e.processId === interactiveTerminal.processId) {
			disposeTerminal();
		}
	});

	configuration = vscode.workspace.getConfiguration("qvs");
	
	context.subscriptions.push(executeInInteractiveScalaCommand);
	context.subscriptions.push(executeFileInInteractiveScalaCommand);
	context.subscriptions.push(resetInteractiveScalaCommand);
	context.subscriptions.push(configurationChanged);
	context.subscriptions.push(disposedTerminal);

	initialiseInteractiveScala();
}

export function deactivate() {
	disposeTerminal();
}