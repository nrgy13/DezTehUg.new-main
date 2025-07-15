// Скрипт для включения GitHub Copilot
const vscode = require('vscode');

async function enableCopilot() {
    try {
        // Включаем Copilot
        await vscode.workspace.getConfiguration('github.copilot').update('enable', {
            "*": true,
            "yaml": true,
            "plaintext": true,
            "markdown": true,
            "typescript": true,
            "javascript": true,
            "typescriptreact": true,
            "javascriptreact": true
        }, vscode.ConfigurationTarget.Global);

        // Включаем inline suggestions
        await vscode.workspace.getConfiguration('editor').update('inlineSuggest.enabled', true, vscode.ConfigurationTarget.Global);
        
        console.log('GitHub Copilot включен успешно!');
        
        // Показываем уведомление
        vscode.window.showInformationMessage('GitHub Copilot активирован! Перезапустите VS Code для применения изменений.');
        
    } catch (error) {
        console.error('Ошибка при включении Copilot:', error);
        vscode.window.showErrorMessage('Не удалось включить Copilot: ' + error.message);
    }
}

module.exports = { enableCopilot };