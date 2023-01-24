import * as vscode from 'vscode';
import { Configuration, OpenAIApi, CreateEditRequest } from "openai";
import {
	initAuth,
	createPayload,
	validatePayload,
	setNewAPIKey,
	getFileExtension,
	buildStatusBarItem,
	Config,
	OPENAI_API_KEY,
	validateEditPayload
} from './utils';

const COPY_OUTPUT = "Copy Output";

const initOpenAI = (credentials: Config): OpenAIApi => {
	const openaiConfig = new Configuration({
		...credentials
	});

	return new OpenAIApi(openaiConfig);
};

function commentOutCode(code: string, language: string) {
	switch (language) {
		case 'javascript':
		case 'typescript':
		case 'python':
		case 'ruby':
		case 'java':
		case 'go':
		case 'php':
		case 'c':
		case 'cpp':
		case 'csharp':
		case 'swift':
		case 'scala':
			return `// ${code}`;
		case 'html':
		case 'css':
			return `<!-- ${code} -->`;
		case 'json':
			return `/* ${code} */`;
		case 'markdown':
			return `<!-- ${code} -->`;
		case 'yaml':
			return `# ${code}`;
		case 'terraform':
			return `# ${code}`;
		default:
			return code;
	}
}

function fileExtensionToLanguage(fileExtension: string) {
	switch (fileExtension) {
		case 'js':
			return 'javascript';
		case 'ts':
			return 'typescript';
		case 'py':
			return 'python';
		case 'rb':
			return 'ruby';
		case 'java':
			return 'java';
		case 'go':
			return 'go';
		case 'php':
			return 'php';
		case 'c':
			return 'c';
		case 'cpp':
			return 'cpp';
		case 'cs':
			return 'csharp';
		case 'swift':
			return 'swift';
		case 'scala':
			return 'scala';
		case 'html':
			return 'html';
		case 'css':
			return 'css';
		case 'json':
			return 'json';
		case 'md':
			return 'markdown';
		case 'yaml':
			return 'yaml';
		case 'yml':
			return 'yaml';
		case 'sc':
			return 'scala';
		case 'tf':
			return 'terraform';
		default:
			return 'plaintext';
	}
}

// This method is called when the extension is activated
export async function activate(context: vscode.ExtensionContext) {
	console.log('Activated');

	const credentials = await initAuth(context);
	if (!credentials) {
		deactivate();

		return;
	}

	const openai = initOpenAI(credentials);

	const statusBarItem = buildStatusBarItem();

	statusBarItem.show();

	const modalMesesageOptions = {
		"modal": true,
		"detail": "- GPT-3"
	};

	// Create documentation for highlighted code
	let createDocumentation = vscode.commands.registerCommand('GPT.createDocs', async () => {
		console.log('Running createDocs');

		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			return;
		}

		const selectedText = editor.document.getText(editor.selection);

		if (!selectedText) {
			vscode.window.showWarningMessage('No selected text');
			return;
		}

		let fileExtension = getFileExtension(editor.document.fileName);

		statusBarItem.hide();
		const statusMessage = vscode.window.setStatusBarMessage('$(heart) Generating your documentation! $(book)');

		const prompt = `Write ${fileExtensionToLanguage(fileExtension)} doc comments for the code
Code: 
${selectedText}
			
Doc comments:
`;

		let payload = createPayload('text', prompt);
		let { isValid, reason } = validatePayload(payload);

		if (!isValid) {
			vscode.window.showErrorMessage(reason);
			deactivate();
		};

		const response = await openai.createCompletion({ ...payload });

		const output = response.data.choices[0].text?.trim();

		if(response.data.usage?.total_tokens && response.data.usage?.total_tokens >= payload.max_tokens) {
			vscode.window.showErrorMessage(`The completion was ${response.data.usage?.total_tokens} tokens and exceeds your max_token value of ${payload.max_tokens}. Please increase your settings to allow for longer completions.`);
		}

		// Insert the text at the start of the selection
		editor.edit((editBuilder) => {
			editBuilder.insert(editor.selection.start, `${output}\n`);
		});

		statusMessage.dispose();
		statusBarItem.show();
	});

	// Create code for highlighted documentation
	let createCodeFromDocumentation = vscode.commands.registerCommand('GPT.createCodeFromDocs', async () => {
		console.log('Running createCodeFromDocs');

		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			return;
		}

		const selectedText = editor.document.getText(editor.selection);

		if (!selectedText) {
			vscode.window.showWarningMessage('No selected text');
			return;
		}

		let fileExtension = getFileExtension(editor.document.fileName);

		statusBarItem.hide();
		const statusMessage = vscode.window.setStatusBarMessage('$(heart) Generating your code! $(code)');

		const prompt = `Write ${fileExtensionToLanguage(fileExtension)} code to satisfy these doc comments. 
Doc comments: 
${selectedText}
				
Code:
`;


		let payload = createPayload('code', prompt);
		let { isValid, reason } = validatePayload(payload);

		if (!isValid) {
			vscode.window.showErrorMessage(reason);
			deactivate();
		};

		const response = await openai.createCompletion({ ...payload });

		const output = response.data.choices[0].text?.trim();

		if(response.data.usage?.total_tokens && response.data.usage?.total_tokens >= payload.max_tokens) {
			vscode.window.showErrorMessage(`The completion was ${response.data.usage?.total_tokens} tokens and exceeds your max_token value of ${payload.max_tokens}. Please increase your settings to allow for longer completions.`);
		}

		// Insert the text at the start of the selection
		editor.edit((editBuilder) => {
			editBuilder.insert(editor.selection.end, `\n${output}`);
		});

		statusMessage.dispose();
		statusBarItem.show();
	});

	// Create a suggested alternative to highlight code with an explanation
	let suggestImprovement = vscode.commands.registerCommand('GPT.suggestImprovement', async () => {
		console.log('Running suggestImprovement');
		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			return;
		}

		const selectedText = editor.document.getText(editor.selection);

		if (!selectedText) {
			vscode.window.showWarningMessage('No selected text');
			return;
		}

		let fileExtension = getFileExtension(editor.document.fileName);

		statusBarItem.hide();
		const statusMessage = vscode.window.setStatusBarMessage('$(heart) Generating your suggestion! $(edit)');

		const prompt = `Improve the Original ${fileExtensionToLanguage(fileExtension)} code. 
Provde Suggested ${fileExtensionToLanguage(fileExtension)} code and an explanation for why it is better.
Original code: 
${selectedText}

Suggested code:
`;

		let payload = createPayload('text', prompt);
		let { isValid, reason } = validatePayload(payload);

		if (!isValid) {
			vscode.window.showErrorMessage(reason);
			deactivate();
		};

		const response = await openai.createCompletion({ ...payload });

		if(response.data.usage?.total_tokens && response.data.usage?.total_tokens >= payload.max_tokens) {
			vscode.window.showErrorMessage(`The completion was ${response.data.usage?.total_tokens} tokens and exceeds your max_token value of ${payload.max_tokens}. Please increase your settings to allow for longer completions.`);
		}

		const output = response.data.choices[0].text?.trim() || "A response is not available right now.";

		let items = [
			{
				"title": COPY_OUTPUT
			}
		];

		const gptResponse = vscode.window.showInformationMessage(output, modalMesesageOptions, ...items);

		gptResponse.then((button) => {
			if (button?.title === COPY_OUTPUT) {
				vscode.env.clipboard.writeText(output);
			}
		});

		statusMessage.dispose();
		statusBarItem.show();
	});

	// Directly write a prompt for GPT
	let askGPT = vscode.commands.registerCommand('GPT.askGPT', async () => {
		console.log('Running askGPT');

		const inputBoxOptions = {
			"title": "Ask GPT!",
			"prompt": "Enter in the text you would like to send to GPT"
		};

		const prompt = await vscode.window.showInputBox(inputBoxOptions);

		if (!prompt) {
			vscode.window.showWarningMessage('No input received.');
			return;
		}

		statusBarItem.hide();
		const statusMessage = vscode.window.setStatusBarMessage('$(heart) Sending to GPT! $(hubot)');

		let payload = createPayload('text', prompt);
		let { isValid, reason } = validatePayload(payload);

		if (!isValid) {
			vscode.window.showErrorMessage(reason);
			deactivate();
		};

		const response = await openai.createCompletion({ ...payload });

		if(response.data.usage?.total_tokens && response.data.usage?.total_tokens >= payload.max_tokens) {
			vscode.window.showErrorMessage(`The completion was ${response.data.usage?.total_tokens} tokens and exceeds your max_token value of ${payload.max_tokens}. Please increase your settings to allow for longer completions.`);
		}

		const output = response.data.choices[0].text?.trim() || "A response is not available right now.";

		let items = [
			{
				"title": COPY_OUTPUT
			}
		];

		const gptResponse = vscode.window.showInformationMessage(output, modalMesesageOptions, ...items);

		gptResponse.then((button) => {
			if (button?.title === COPY_OUTPUT) {
				vscode.env.clipboard.writeText(output);
			}
		});

		statusMessage.dispose();
		statusBarItem.show();
	});

	// Update OpenAI API Key
	let updateAPIKey = vscode.commands.registerCommand('GPT.updateAPIKey', async () => {
		console.log('Running updateAPIKey');

		statusBarItem.hide();
		const statusMessage = vscode.window.setStatusBarMessage('$(heart) Securely storing your API Key $(pencil)');

		await setNewAPIKey(context);

		statusMessage.dispose();
		statusBarItem.show();
	});

	// Remove OpenAI API Key
	let removeAPIKey = vscode.commands.registerCommand('GPT.removeAPIKey', async () => {
		console.log('Running removeAPIKey');

		statusBarItem.hide();
		const statusMessage = vscode.window.setStatusBarMessage('$(heart) Securely REMOVING your API Key $(error)');

		await context.secrets.delete(OPENAI_API_KEY);

		statusMessage.dispose();
		statusBarItem.show();
	});

	function createDecoration(selection: vscode.Selection) {
		return {
			range: selection,
			hoverMessage: 'Codex is working on this code. Please wait...'
		};
	}

	const decorationType = vscode.window.createTextEditorDecorationType({
		isWholeLine: true,
		borderWidth: '1px',
		borderStyle: 'solid',
		overviewRulerColor: 'blue',
		overviewRulerLane: vscode.OverviewRulerLane.Right,
		light: {
			borderColor: 'darkblue',
			after: {
				contentText: 'Codex is working on this code. Please wait...',
			}
		},
		dark: {
			borderColor: 'lightblue',
			after: {
				contentText: 'Codex is working on this code. Please wait...',
			}
		}
	});

	let editWithCodex = vscode.commands.registerCommand('GPT.editWithCodex', async () => {
		console.log('Running createCodeFromDocs');

		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			return;
		}
		const selection = editor.selection;

		const selectedText = editor.document.getText(selection);

		if (!selectedText) {
			vscode.window.showWarningMessage('No selected text');
			return;
		}

		console.log('selectedText', selectedText);

		let fileExtension = getFileExtension(editor.document.fileName);

		statusBarItem.hide();
		const statusMessage = vscode.window.setStatusBarMessage('$(heart) Generating your code! $(code)');
		let language = fileExtensionToLanguage(fileExtension);

		let languageComment = commentOutCode(`language: ${language}`, language);

		const input = 
		`${languageComment}
		${selectedText}`;

		let instruction = await vscode.window.showInputBox({
			title: "Edit with Codex",
			prompt: "What do you want Codex to do to your selected code?",
		});

		if (!instruction) {
			return;
		}

		let payload = {
			model: "code-davinci-edit-001",
			input: input,
			instruction: instruction,
		};

		console.log('payload', payload);
		
		let { isValid, reason } = validateEditPayload(payload);

		if (!isValid) {
			vscode.window.showErrorMessage(reason);
			deactivate();
		};

		// Insert decoration to mark the selection we are editing
		editor.setDecorations(decorationType, [createDecoration(selection)]);
		
		const response = await openai.createEdit({ ...payload });

		console.log('response', response.data.choices[0].text);

		let output = response.data.choices[0].text?.trim();

		if (output?.startsWith(languageComment)){
			output = output.replace(languageComment, '');
		}

		if (output) {
			editor.edit((editBuilder) => {
				editBuilder.replace(selection, output!);
			});
		} else {
			vscode.window.showErrorMessage('No output received.');
		}

		// Insert the text at the start of the selection
		
		editor.setDecorations(decorationType, []);
		statusMessage.dispose();
		statusBarItem.show();
	});

	context.subscriptions.push(
		createDocumentation,
		createCodeFromDocumentation,
		suggestImprovement,
		askGPT,
		updateAPIKey,
		removeAPIKey,
		editWithCodex
	);
};

// This method is called when your extension is deactivated
export function deactivate() { }
